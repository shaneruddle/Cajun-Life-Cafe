import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, getDocs, where, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, FileText, ChevronRight, Database, X, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format, parseISO, parse, isValid } from 'date-fns';
import { handleFirestoreError } from '../../utils/firestore';
import { OperationType } from '../../types';
import { logActivity } from '../../utils/logger';

interface FinanceCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'dividend';
  uid: string;
}

const BulkFinanceImport: React.FC = () => {
  const [csvData, setCsvData] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'input' | 'mapping'>('input');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [existingCategories, setExistingCategories] = useState<FinanceCategory[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const shouldCancel = useRef(false);

  const targetFields = [
    { key: 'date', label: 'Date (YYYY-MM-DD) *', required: true },
    { key: 'type', label: 'Type (income/expense/dividend) *', required: true },
    { key: 'category', label: 'Category Name *', required: true },
    { key: 'amount', label: 'Amount *', required: true },
    { key: 'description', label: 'Description' },
  ];

  useEffect(() => {
    const fetchCategories = async () => {
      const q = query(collection(db, 'finance_categories'));
      const snapshot = await getDocs(q);
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceCategory[];
      setExistingCategories(cats);
    };
    fetchCategories();
  }, []);

  const parseCSV = (text: string) => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
        }
        if (char === '\r' && nextChar === '\n') i++;
      } else {
        currentField += char;
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField);
      rows.push(currentRow);
    }
    return rows;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
      setStatus({ type: 'info', message: `File "${file.name}" loaded. Click Analyze to continue.` });
    };
    reader.onerror = () => {
      setStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);
  };

  const handleAnalyze = () => {
    if (!csvData.trim()) return;
    const rows = parseCSV(csvData);
    if (rows.length < 2) {
      setStatus({ type: 'error', message: 'Invalid CSV format. Header row and at least one data row required.' });
      return;
    }

    const csvHeaders = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
    setHeaders(csvHeaders);
    setParsedRows(rows.slice(1));
    
    // Attempt auto-mapping
    const initialMappings: Record<string, string> = {};
    targetFields.forEach(field => {
      const match = csvHeaders.find(h => 
        h.toLowerCase() === field.key.toLowerCase() || 
        h.toLowerCase() === field.label.toLowerCase().replace(/\s/g, '_') ||
        (field.key === 'amount' && h.toLowerCase() === 'value') ||
        (field.key === 'category' && h.toLowerCase() === 'cat')
      );
      if (match) initialMappings[field.key] = match;
    });
    
    setMappings(initialMappings);
    setStep('mapping');
    setStatus(null);
  };

  const pendingCategories = useRef<Record<string, Promise<FinanceCategory>>>({});

  const getOrCreateCategory = async (name: string, type: 'income' | 'expense' | 'dividend') => {
    const normalizedName = name.trim();
    const cacheKey = `${normalizedName.toLowerCase()}|${type}`;
    
    const existing = existingCategories.find(c => 
      c.name.toLowerCase() === normalizedName.toLowerCase() && c.type === type
    );

    if (existing) return existing;

    // Check if this category is already being created in this batch
    if (pendingCategories.current[cacheKey]) {
      return await pendingCategories.current[cacheKey];
    }

    // Create new category with a promise to handle concurrent requests for same category
    const createPromise = (async () => {
      try {
        const newCat = {
          name: normalizedName,
          type,
          uid: auth.currentUser?.uid
        };
        const docRef = await addDoc(collection(db, 'finance_categories'), newCat);
        const createdCat = { id: docRef.id, ...newCat } as FinanceCategory;
        setExistingCategories(prev => [...prev, createdCat]);
        return createdCat;
      } finally {
        delete pendingCategories.current[cacheKey];
      }
    })();

    pendingCategories.current[cacheKey] = createPromise;
    return await createPromise;
  };

  const normalizeDate = (d: any) => {
    if (!d) return '';
    const dateStr = typeof d === 'string' ? d : 
                   (d && typeof (d as any).toDate === 'function') ? (d as any).toDate().toISOString() : '';
    
    if (!dateStr) return '';

    // Try to extract YYYY-MM-DD or YYYY-M-D
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      const date = new Date(year, month - 1, day);
      if (isValid(date)) return format(date, 'yyyy-MM-dd');
    }

    // Try MM/DD/YYYY
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const month = parseInt(slashMatch[1]);
      const day = parseInt(slashMatch[2]);
      const year = parseInt(slashMatch[3]);
      const date = new Date(year, month - 1, day);
      if (isValid(date)) return format(date, 'yyyy-MM-dd');
    }

    // Fallback to native Date for other formats
    const nativeDate = new Date(dateStr);
    if (isValid(nativeDate)) return format(nativeDate, 'yyyy-MM-dd');

    return dateStr.substring(0, 10);
  };

  const handleUpload = async () => {
    setLoading(true);
    shouldCancel.current = false;
    setStatus({ type: 'info', message: 'Fetching existing entries to prevent duplicates...' });
    setProgress(0);

    try {
      // Fetch existing entries to detect duplicates
      const entriesSnapshot = await getDocs(query(collection(db, 'finance_entries'), where('uid', '==', auth.currentUser?.uid)));
      
      // Use a Set for faster lookup and to handle duplicates within the same CSV
      const seenEntries = new Set(entriesSnapshot.docs.map(doc => {
        const data = doc.data();
        const amount = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount) || 0;
        return `${data.type}|${amount.toFixed(2)}|${data.categoryId}|${data.date}|${data.description || ''}`;
      }));

      const total = parsedRows.length;
      let count = 0;
      let skipped = 0;

      setStatus({ type: 'info', message: 'Importing entries...' });

      for (let i = 0; i < parsedRows.length; i++) {
        if (shouldCancel.current) {
          setStatus({ type: 'error', message: `Import cancelled. ${count} entries were imported, ${skipped} duplicates skipped.` });
          toast.error('Import cancelled');
          return;
        }

        const row = parsedRows[i];
        const entryBase: any = {
          createdBy: auth.currentUser?.email || 'Unknown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          uid: auth.currentUser?.uid
        };

        let rowData: any = {};
        targetFields.forEach(field => {
          const csvHeader = mappings[field.key];
          if (!csvHeader) return;
          
          const headerIndex = headers.indexOf(csvHeader);
          if (headerIndex === -1) return;

          let value = row[headerIndex]?.trim().replace(/^"|"$/g, '');
          rowData[field.key] = value;
        });

        if (rowData.date && rowData.type && rowData.category && rowData.amount) {
          const rawType = rowData.type.toLowerCase();
          const type = rawType === 'income' ? 'income' : rawType === 'dividend' ? 'dividend' : 'expense';
          const amount = parseFloat(rowData.amount.replace(/[^0-9.-]+/g, '')) || 0;
          const normalizedDate = normalizeDate(rowData.date);
          const description = rowData.description || '';
          
          const category = await getOrCreateCategory(rowData.category, type);
          
          // Check for duplicate using the Set
          const entryKey = `${type}|${amount.toFixed(2)}|${category.id}|${normalizedDate}|${description}`;
          
          if (seenEntries.has(entryKey)) {
            skipped++;
            continue;
          }

          // Add to seenEntries IMMEDIATELY to prevent race conditions with identical rows in same CSV
          seenEntries.add(entryKey);

          const finalEntry = {
            ...entryBase,
            type,
            amount,
            categoryId: category.id,
            categoryName: category.name,
            description,
            date: normalizedDate
          };

          try {
            await addDoc(collection(db, 'finance_entries'), finalEntry);
            count++;
          } catch (err: any) {
            // If we hit a "Document already exists" error, it's likely a retry success or rare collision
            if (err.message?.includes('already exists')) {
              console.warn("Document already exists error caught, skipping entry:", entryKey);
              skipped++;
            } else {
              throw err;
            }
          }
        }
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      setStatus({ type: 'success', message: `Successfully imported ${count} finance entries! ${skipped} duplicates were skipped.` });
      await logActivity('Bulk Finance Import', `Imported ${count} finance entries via CSV (${skipped} skipped)`, 'finance');
      setCsvData('');
      setStep('input');
      toast.success(`Import complete: ${count} added, ${skipped} skipped.`);
    } catch (err: any) {
      console.error("Import error:", err);
      setStatus({ type: 'error', message: `Import failed: ${err.message}` });
      toast.error('Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllEntries = async () => {
    setConfirmModal({
      show: true,
      title: 'Clear All Entries',
      message: 'Are you absolutely sure you want to delete ALL finance entries? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        setStatus({ type: 'info', message: 'Deleting all finance entries...' });
        
        try {
          const q = query(collection(db, 'finance_entries'));
          const snapshot = await getDocs(q);
          
          let count = 0;
          const total = snapshot.docs.length;
          
          if (total === 0) {
            setStatus({ type: 'info', message: 'No entries found to delete.' });
            setLoading(false);
            return;
          }

          for (let i = 0; i < total; i++) {
            const docSnap = snapshot.docs[i];
            try {
              await deleteDoc(doc(db, 'finance_entries', docSnap.id));
              count++;
              setProgress(Math.round(((i + 1) / total) * 100));
            } catch (err) {
              handleFirestoreError(err, 'delete', `finance_entries/${docSnap.id}`);
            }
          }

          setStatus({ type: 'success', message: `Successfully deleted ${count} finance entries!` });
          toast.success(`Deleted ${count} entries`);
        } catch (err: any) {
          console.error("Delete error:", err);
          setStatus({ type: 'error', message: `Delete failed: ${err.message}` });
          toast.error('Delete failed');
        } finally {
          setLoading(false);
          setProgress(0);
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 pt-24">
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard/finance" className="inline-flex items-center gap-2 text-olive hover:text-terracotta mb-8 font-medium transition-colors">
          <ArrowLeft size={20} /> Back to Finance Dashboard
        </Link>

        <div className="bg-white rounded-[32px] shadow-xl p-8 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-terracotta/10 p-4 rounded-2xl text-terracotta">
                <span className="text-[32px] font-bold leading-none">฿</span>
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-ink">Bulk Finance Import</h1>
                <p className="text-gray-500">
                  {step === 'input' ? 'Upload your finance CSV data to begin.' : 'Map your CSV columns to the finance fields.'}
                </p>
              </div>
            </div>
            
            {step === 'input' && (
              <button
                onClick={handleClearAllEntries}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-100 text-red-500 hover:bg-red-50 font-bold text-sm transition-all disabled:opacity-50"
              >
                <Trash2 size={18} /> Clear All Entries
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {step === 'input' ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-[24px] cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-10 h-10 mb-3 text-gray-400" />
                        <p className="mb-2 text-sm text-gray-500 font-medium">
                          <span className="font-bold text-terracotta">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-400">CSV files only</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".csv"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-200"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-400 font-bold tracking-widest">Or paste content</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <FileText size={14} /> CSV Content
                    </label>
                    <textarea 
                      className="w-full h-48 p-6 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none font-mono text-sm leading-relaxed bg-gray-50"
                      placeholder='Paste CSV content here... (e.g. "Date","Type","Category","Amount","Description")'
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={handleAnalyze}
                    disabled={!csvData.trim()}
                    className="bg-terracotta text-white flex items-center gap-2 px-12 py-4 rounded-2xl font-bold text-lg disabled:opacity-50 hover:bg-terracotta/90 transition-all"
                  >
                    Analyze CSV <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="mapping"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {targetFields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <label className="text-sm font-bold text-ink flex items-center justify-between">
                        <span>{field.label}</span>
                        {field.required && <span className="text-xs text-red-500 font-normal">Required</span>}
                      </label>
                      <select
                        value={mappings[field.key] || ''}
                        onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-white text-sm"
                      >
                        <option value="">-- Select CSV Column --</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                  <button 
                    onClick={() => setStep('input')}
                    className="text-gray-500 hover:text-ink font-medium transition-colors"
                  >
                    Back to Input
                  </button>
                  <button 
                    onClick={handleUpload}
                    disabled={loading || !mappings.date || !mappings.type || !mappings.category || !mappings.amount}
                    className="bg-terracotta text-white flex items-center gap-2 px-12 py-4 rounded-2xl font-bold text-lg disabled:opacity-50 hover:bg-terracotta/90 transition-all"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={20} />
                        Confirm & Start Import
                      </>
                    )}
                  </button>
                </div>

                {loading && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-olive">Processing {parsedRows.length} rows...</span>
                        <span className="text-terracotta">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div 
                          className="bg-terracotta h-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          shouldCancel.current = true;
                          toast.info('Cancelling import...');
                        }}
                        className="text-red-500 hover:text-red-600 font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-xl border border-red-100 hover:bg-red-50 transition-all"
                      >
                        <X size={16} /> Stop Import
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {status && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-8 p-6 rounded-2xl flex items-start gap-4 border ${
                status.type === 'success' ? 'bg-green-50 border-green-100 text-green-800' :
                status.type === 'error' ? 'bg-red-50 border-red-100 text-red-800' :
                'bg-blue-50 border-blue-100 text-blue-800'
              }`}
            >
              {status.type === 'success' ? <CheckCircle2 className="mt-1 shrink-0" /> : <AlertCircle className="mt-1 shrink-0" />}
              <div>
                <p className="font-bold">{status.type === 'success' ? 'Success!' : status.type === 'error' ? 'Error' : 'Info'}</p>
                <p className="text-sm opacity-90">{status.message}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmModal.show && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl p-8"
              >
                <h2 className="text-2xl font-bold text-ink mb-4">{confirmModal.title}</h2>
                <p className="text-gray-600 mb-8">{confirmModal.message}</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                    className="flex-1 px-6 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmModal.onConfirm}
                    className="flex-1 px-6 py-3 rounded-2xl font-bold bg-terracotta text-white hover:bg-terracotta/90 transition-all"
                  >
                    Confirm
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="mt-8 bg-olive/5 p-6 rounded-2xl border border-olive/10">
          <h3 className="font-bold text-olive mb-2 flex items-center gap-2">
            <Database size={18} /> CSV Format Tips
          </h3>
          <ul className="text-sm text-olive/80 space-y-1 list-disc pl-5">
            <li>Ensure the first row contains headers like <strong>Date, Type, Category, Amount</strong>.</li>
            <li><strong>Date</strong> should be in YYYY-MM-DD format.</li>
            <li><strong>Type</strong> should be "income", "expense", or "dividend".</li>
            <li>New categories will be created automatically if they don't exist.</li>
            <li>Amounts can include currency symbols or commas; they will be cleaned automatically.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BulkFinanceImport;
