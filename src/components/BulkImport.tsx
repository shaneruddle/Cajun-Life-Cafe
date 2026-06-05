import React, { useState } from 'react';
import { collection, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { normalizeImageUrl } from '../utils/images';
import { logActivity } from '../utils/logger';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, FileText, ChevronRight, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

const BulkImport: React.FC = () => {
  const [csvData, setCsvData] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'input' | 'mapping'>('input');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<string[][]>([]);

  const targetFields = [
    { key: 'name', label: 'Name (English) *', required: true },
    { key: 'category', label: 'Category *', required: true },
    { key: 'price', label: 'Price *', required: true },
    { key: 'description', label: 'Description (English)' },
    { key: 'name_chinese', label: 'Name (Chinese)' },
    { key: 'description_chinese', label: 'Description (Chinese)' },
    { key: 'name_russian', label: 'Name (Russian)' },
    { key: 'description_russian', label: 'Description (Russian)' },
    { key: 'name_thai', label: 'Name (Thai)' },
    { key: 'description_thai', label: 'Description (Thai)' },
    { key: 'image', label: 'Image URL' },
    { key: 'primaryPhotoPath', label: 'Primary Photo Path (gs://...)' },
    { key: 'secondaryPhotoPath', label: 'Secondary Photo Path (gs://...)' },
    { key: 'order', label: 'Display Order' },
    { key: 'published', label: 'Published Status' },
    { key: 'originalId', label: 'Unique ID (for updates)' },
  ];

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
        (field.key === 'category' && h.toLowerCase() === 'food_category') ||
        (field.key === 'originalId' && h.toLowerCase() === 'unique id')
      );
      if (match) initialMappings[field.key] = match;
    });
    
    setMappings(initialMappings);
    setStep('mapping');
    setStatus(null);
  };

  const handleUpload = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Importing items...' });
    setProgress(0);

    try {
      const total = parsedRows.length;
      let count = 0;

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const item: any = {
          published: true,
          order: 0,
          uid: auth.currentUser?.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        targetFields.forEach(field => {
          const csvHeader = mappings[field.key];
          if (!csvHeader) return;
          
          const headerIndex = headers.indexOf(csvHeader);
          if (headerIndex === -1) return;

          let value = row[headerIndex]?.trim().replace(/^"|"$/g, '');
          
          if (field.key === 'order') {
            item.order = parseInt(value) || 0;
          } else if (field.key === 'published') {
            item.published = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
          } else if (field.key === 'image' || field.key === 'primaryPhotoPath' || field.key === 'secondaryPhotoPath') {
            item[field.key] = normalizeImageUrl(value);
          } else {
            item[field.key] = value || '';
          }
        });

        if (item.name && item.category && item.price) {
          const docId = item.originalId || null;
          if (docId) {
            delete item.originalId;
            await setDoc(doc(db, 'menu', docId), item);
          } else {
            await addDoc(collection(db, 'menu'), item);
          }
          count++;
        }
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      setStatus({ type: 'success', message: `Successfully imported ${count} menu items!` });
      await logActivity('Bulk Menu Import', `Imported ${count} menu items via CSV`, 'menu');
      setCsvData('');
      setStep('input');
    } catch (err: any) {
      console.error("Import error:", err);
      setStatus({ type: 'error', message: `Import failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 pt-12">
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-olive hover:text-terracotta mb-8 font-medium transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>

        <div className="bg-white rounded-[32px] shadow-xl p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-terracotta/10 p-4 rounded-2xl text-terracotta">
              <Upload size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-ink">Bulk Menu Import</h1>
              <p className="text-gray-500">
                {step === 'input' ? 'Paste your CSV data below to begin.' : 'Map your CSV columns to the menu fields.'}
              </p>
            </div>
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
                      placeholder='Paste CSV content here... (e.g. "Name","Price","Category"...)'
                      value={csvData}
                      onChange={(e) => setCsvData(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={handleAnalyze}
                    disabled={!csvData.trim()}
                    className="terracotta-button flex items-center gap-2 px-12 py-4 text-lg disabled:opacity-50"
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
                    disabled={loading || !mappings.name || !mappings.category || !mappings.price}
                    className="terracotta-button flex items-center gap-2 px-12 py-4 text-lg disabled:opacity-50"
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

        <div className="mt-8 bg-olive/5 p-6 rounded-2xl border border-olive/10">
          <h3 className="font-bold text-olive mb-2 flex items-center gap-2">
            <Database size={18} /> CSV Format Tips
          </h3>
          <ul className="text-sm text-olive/80 space-y-1 list-disc pl-5">
            <li>Ensure the first row contains headers like <strong>Name, Price, Category</strong>.</li>
            <li>The importer handles multi-language columns (e.g., <strong>Name_Chinese, Description_Thai</strong>).</li>
            <li>Image URLs starting with <code>//</code> will automatically be prefixed with <code>https:</code>.</li>
            <li>If a <strong>unique id</strong> column is present, map it to <strong>Unique ID</strong> to update existing items.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BulkImport;

