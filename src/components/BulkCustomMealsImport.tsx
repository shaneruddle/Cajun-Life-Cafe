import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp, query, getDocs, writeBatch } from 'firebase/firestore';
import { db, auth , menuDb} from '../firebase';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, FileText, ChevronRight, Database, Scale, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { logActivity } from '../utils/logger';

const BulkCustomMealsImport: React.FC = () => {
  const navigate = useNavigate();
  const [importMode, setImportMode] = useState<'single' | 'dual'>('single');
  const [csvData, setCsvData] = useState('');
  const [csvData2, setCsvData2] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearBeforeImport, setClearBeforeImport] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'input' | 'join' | 'mapping'>('input');
  const [headers, setHeaders] = useState<string[]>([]);
  const [headers2, setHeaders2] = useState<string[]>([]);
  const [joinKey1, setJoinKey1] = useState('');
  const [joinKey2, setJoinKey2] = useState('');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [parsedRows2, setParsedRows2] = useState<string[][]>([]);
  const [mergedRows, setMergedRows] = useState<Record<string, any>[]>([]);

  const targetFields = [
    { key: 'name', label: 'Ingredient Name *', required: true },
    { key: 'type', label: 'Type (Protein/Carb/Veggie/Base) *', required: true },
    { key: 'description', label: 'Description' },
    { key: 'order', label: 'Display Order' },
    { key: 'weight', label: 'Option Weight (e.g. 100g) *', required: true },
    { key: 'price', label: 'Option Price *', required: true },
    { key: 'calories', label: 'Option Calories *', required: true },
    { key: 'protein', label: 'Option Protein *', required: true },
    { key: 'carbs', label: 'Option Carbs *', required: true },
    { key: 'fat', label: 'Option Fat *', required: true },
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileNum: 1 | 2 = 1) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (fileNum === 1) {
        setCsvData(text);
        setStatus({ type: 'info', message: `File 1 "${file.name}" loaded.` });
      } else {
        setCsvData2(text);
        setStatus({ type: 'info', message: `File 2 "${file.name}" loaded.` });
      }
    };
    reader.onerror = () => {
      setStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);
  };

  const handleAnalyze = () => {
    if (!csvData.trim()) return;
    if (importMode === 'dual' && !csvData2.trim()) {
      setStatus({ type: 'error', message: 'Please provide both files for dual-file import.' });
      return;
    }

    const rows1 = parseCSV(csvData);
    if (rows1.length < 2) {
      setStatus({ type: 'error', message: 'File 1 is invalid. Header row and data required.' });
      return;
    }

    const csvHeaders1 = rows1[0].map(h => h.trim().replace(/^"|"$/g, ''));
    setHeaders(csvHeaders1);
    setParsedRows(rows1.slice(1));

    if (importMode === 'dual') {
      const rows2 = parseCSV(csvData2);
      if (rows2.length < 2) {
        setStatus({ type: 'error', message: 'File 2 is invalid. Header row and data required.' });
        return;
      }
      const csvHeaders2 = rows2[0].map(h => h.trim().replace(/^"|"$/g, ''));
      setHeaders2(csvHeaders2);
      setParsedRows2(rows2.slice(1));
      
      // Auto-detect join keys
      const key1 = csvHeaders1.find(h => h.toLowerCase().includes('gram') || h.toLowerCase().includes('selection'));
      const key2 = csvHeaders2.find(h => h.toLowerCase().includes('gram') || h.toLowerCase().includes('selection'));
      if (key1) setJoinKey1(key1);
      if (key2) setJoinKey2(key2);
      
      setStep('join');
    } else {
      // Single file mode: proceed to mapping
      const initialMappings: Record<string, string> = {};
      targetFields.forEach(field => {
        const match = csvHeaders1.find(h => 
          h.toLowerCase() === field.key.toLowerCase() || 
          h.toLowerCase() === field.label.toLowerCase().replace(/\s/g, '_') ||
          h.toLowerCase().includes(field.key.toLowerCase())
        );
        if (match) initialMappings[field.key] = match;
      });
      setMappings(initialMappings);
      setStep('mapping');
    }
    setStatus(null);
  };

  const handleJoin = () => {
    if (!joinKey1 || !joinKey2) {
      setStatus({ type: 'error', message: 'Please select join keys for both files.' });
      return;
    }

    const key1Index = headers.indexOf(joinKey1);
    const key2Index = headers2.indexOf(joinKey2);

    // Create a map of File 1 data for easy lookup
    const file1Map: Record<string, any[]> = {};
    parsedRows.forEach(row => {
      const key = row[key1Index]?.trim().toLowerCase();
      if (!key) return;
      
      const obj: any = {};
      headers.forEach((h, idx) => obj[h] = row[idx]);
      if (!file1Map[key]) file1Map[key] = [];
      file1Map[key].push(obj);
    });

    // Merge with File 2
    const merged: Record<string, any>[] = [];
    parsedRows2.forEach(row2 => {
      const rawKey = row2[key2Index]?.trim();
      
      const itemObj: any = {};
      headers2.forEach((h, idx) => itemObj[h] = row2[idx]);

      if (rawKey) {
        // Handle comma-separated keys (e.g. "id1, id2, id3")
        const keys = rawKey.split(',').map(k => k.trim().toLowerCase());
        let foundAny = false;

        keys.forEach(key => {
          const file1Objs = file1Map[key];
          if (file1Objs) {
            file1Objs.forEach(file1Obj => {
              const mergedObj = { ...file1Obj, ...itemObj };
              // Handle header collisions by prefixing File 2 headers if they exist in File 1
              headers2.forEach(h => {
                if (headers.includes(h)) {
                  mergedObj[`f2_${h}`] = itemObj[h];
                }
              });
              merged.push(mergedObj);
              foundAny = true;
            });
          }
        });

        // If no matching options found for this key, still add the item itself
        if (!foundAny) {
          merged.push(itemObj);
        }
      } else {
        // No key at all, still add the item
        merged.push(itemObj);
      }
    });

    if (merged.length === 0) {
      setStatus({ type: 'error', message: 'No matches found between the two files using the selected keys.' });
      return;
    }

    setMergedRows(merged);
    
    // Collect all headers from merged rows
    const allKeys = new Set<string>();
    merged.forEach(row => Object.keys(row).forEach(k => allKeys.add(k)));
    const combinedHeaders = Array.from(allKeys);
    setHeaders(combinedHeaders);
    
    // Auto-mapping for merged data
    const initialMappings: Record<string, string> = {};
    targetFields.forEach(field => {
      const match = combinedHeaders.find(h => 
        h.toLowerCase() === field.key.toLowerCase() || 
        h.toLowerCase() === field.label.toLowerCase().replace(/\s/g, '_') ||
        h.toLowerCase().includes(field.key.toLowerCase())
      );
      if (match) initialMappings[field.key] = match;
    });
    setMappings(initialMappings);
    setStep('mapping');
    setStatus({ type: 'success', message: `Successfully joined files! Found ${merged.length} rows to map.` });
  };

  const handleUpload = async () => {
    setLoading(true);
    setStatus({ type: 'info', message: 'Importing items...' });
    setProgress(0);

    try {
      if (clearBeforeImport) {
        setStatus({ type: 'info', message: 'Clearing existing data...' });
        const q = query(collection(menuDb, 'custom_meals'));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const chunks = [];
          for (let i = 0; i < snapshot.docs.length; i += 500) {
            chunks.push(snapshot.docs.slice(i, i + 500));
          }

          for (const chunk of chunks) {
            const batch = writeBatch(db);
            chunk.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();
          }
        }
      }

      const dataToProcess = importMode === 'dual' ? mergedRows : parsedRows;
      const total = dataToProcess.length;
      const mealsMap: Record<string, any> = {};
      let skippedCount = 0;
      let optionsCount = 0;

      for (let i = 0; i < dataToProcess.length; i++) {
        const row = dataToProcess[i];
        
        // Extract data based on mappings
        const rowData: any = {};
        targetFields.forEach(field => {
          const csvHeader = mappings[field.key];
          if (!csvHeader) return;
          
          if (importMode === 'dual') {
            rowData[field.key] = (row as any)[csvHeader]?.toString().trim().replace(/^"|"$/g, '');
          } else {
            const headerIndex = headers.indexOf(csvHeader);
            if (headerIndex !== -1) {
              rowData[field.key] = (row as string[])[headerIndex]?.toString().trim().replace(/^"|"$/g, '');
            }
          }
        });

        if (!rowData.name || !rowData.type) {
          skippedCount++;
          continue;
        }

        const mealKey = rowData.name.toLowerCase().trim();
        
        if (!mealsMap[mealKey]) {
          mealsMap[mealKey] = {
            name: rowData.name,
            type: rowData.type,
            description: rowData.description || '',
            order: parseInt(rowData.order) || 0,
            options: [],
            uid: auth.currentUser?.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
        }

        // Add option if it has at least a price or weight
        if (rowData.price || rowData.weight) {
          const weight = rowData.weight || 'Standard';
          // Check if this weight already exists for this meal to avoid duplicates
          const exists = mealsMap[mealKey].options.some((o: any) => o.weight.toLowerCase() === weight.toLowerCase());
          
          if (!exists) {
            mealsMap[mealKey].options.push({
              weight: weight,
              price: parseFloat(rowData.price) || 0,
              calories: parseFloat(rowData.calories) || 0,
              protein: parseFloat(rowData.protein) || 0,
              carbs: parseFloat(rowData.carbs) || 0,
              fat: parseFloat(rowData.fat) || 0
            });
            optionsCount++;
          }
        }
        
        setProgress(Math.round(((i + 1) / total) * 50));
      }

      const mealEntries = Object.values(mealsMap);
      const totalEntries = mealEntries.length;
      let count = 0;

      for (let i = 0; i < totalEntries; i++) {
        const meal = mealEntries[i];
        await addDoc(collection(menuDb, 'custom_meals'), meal);
        count++;
        setProgress(50 + Math.round(((i + 1) / totalEntries) * 50));
      }

      let finalMessage = `Successfully imported ${count} unique ingredients with ${optionsCount} total nutritional options.`;
      if (skippedCount > 0) {
        finalMessage += ` (${skippedCount} rows were skipped due to missing Name or Type).`;
      }

      setStatus({ 
        type: 'success', 
        message: finalMessage
      });
      await logActivity('Bulk Custom Meal Import', `Imported ${count} ingredients with ${optionsCount} options`, 'custom_meal');
      setCsvData('');
      setCsvData2('');
      setStep('input');
      setTimeout(() => navigate('/dashboard/custom-meals'), 2000);
    } catch (err: any) {
      console.error("Import error:", err);
      setStatus({ type: 'error', message: `Import failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const getImportSummary = () => {
    const dataToProcess = importMode === 'dual' ? mergedRows : parsedRows;
    const mealsMap: Record<string, boolean> = {};
    let optionsCount = 0;
    let skippedCount = 0;

    dataToProcess.forEach(row => {
      const rowData: any = {};
      targetFields.forEach(field => {
        const csvHeader = mappings[field.key];
        if (!csvHeader) return;
        
        if (importMode === 'dual') {
          rowData[field.key] = (row as any)[csvHeader];
        } else {
          const headerIndex = headers.indexOf(csvHeader);
          if (headerIndex !== -1) {
            rowData[field.key] = (row as string[])[headerIndex];
          }
        }
      });

      if (rowData.name && rowData.type) {
        const key = rowData.name.toLowerCase().trim();
        mealsMap[key] = true;
        if (rowData.price || rowData.weight) {
          optionsCount++;
        }
      } else {
        skippedCount++;
      }
    });

    return {
      uniqueIngredients: Object.keys(mealsMap).length,
      totalOptions: optionsCount,
      skipped: skippedCount,
      totalRows: dataToProcess.length
    };
  };

  const summary = step === 'mapping' ? getImportSummary() : null;

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 pt-12">
      <div className="max-w-4xl mx-auto">
        <Link to="/dashboard/custom-meals" className="inline-flex items-center gap-2 text-olive hover:text-terracotta mb-8 font-medium transition-colors">
          <ArrowLeft size={20} /> Back to Custom Meals
        </Link>

        <div className="bg-white rounded-[32_px] shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-terracotta/10 p-4 rounded-2xl text-terracotta">
                <Scale size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-display font-bold text-ink">Bulk Custom Meals Import</h1>
                <p className="text-gray-500">
                  {step === 'input' ? 'Upload your CSV files to begin.' : 
                   step === 'join' ? 'Select how to link your two files.' :
                   'Map your columns to the custom meal fields.'}
                </p>
              </div>
            </div>
            
            {step === 'input' && (
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => setImportMode('single')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${importMode === 'single' ? 'bg-white text-terracotta shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Single File
                </button>
                <button 
                  onClick={() => setImportMode('dual')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${importMode === 'dual' ? 'bg-white text-terracotta shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Two Files
                </button>
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <FileText size={14} /> {importMode === 'dual' ? 'File 1: Items/Names' : 'CSV File'}
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-[24px] cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                          <Upload className="w-8 h-8 mb-3 text-gray-400" />
                          <p className="text-sm text-gray-500 font-medium">
                            <span className="font-bold text-terracotta">Upload File 1</span>
                          </p>
                          {csvData && <p className="text-xs text-green-600 mt-2 font-bold">✓ Loaded</p>}
                        </div>
                        <input type="file" className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 1)} />
                      </label>
                    </div>
                  </div>

                  {importMode === 'dual' && (
                    <div className="space-y-4">
                      <label className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                        <FileText size={14} /> File 2: Grams/Prices
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-[24px] cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                            <Upload className="w-8 h-8 mb-3 text-gray-400" />
                            <p className="text-sm text-gray-500 font-medium">
                              <span className="font-bold text-terracotta">Upload File 2</span>
                            </p>
                            {csvData2 && <p className="text-xs text-green-600 mt-2 font-bold">✓ Loaded</p>}
                          </div>
                          <input type="file" className="hidden" accept=".csv" onChange={(e) => handleFileChange(e, 2)} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={handleAnalyze}
                    disabled={!csvData.trim() || (importMode === 'dual' && !csvData2.trim())}
                    className="terracotta-button flex items-center gap-2 px-12 py-4 text-lg disabled:opacity-50"
                  >
                    Analyze {importMode === 'dual' ? 'Files' : 'CSV'} <ChevronRight size={20} />
                  </button>
                </div>
              </motion.div>
            ) : step === 'join' ? (
              <motion.div 
                key="join"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="bg-olive/5 p-6 rounded-2xl border border-olive/10 mb-6">
                  <p className="text-olive text-sm leading-relaxed">
                    Select the column in each file used to link them together. 
                    For example, select <strong>"gram selections"</strong> in File 1 and the corresponding 
                    identifier in File 2.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ink">File 1 Link Column (e.g. Gram Selections)</label>
                    <select
                      value={joinKey1}
                      onChange={(e) => setJoinKey1(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-white text-sm"
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-ink">File 2 Link Column (Identifier)</label>
                    <select
                      value={joinKey2}
                      onChange={(e) => setJoinKey2(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-white text-sm"
                    >
                      <option value="">-- Select Column --</option>
                      {headers2.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-6 border-t border-gray-100">
                  <button onClick={() => setStep('input')} className="text-gray-500 hover:text-ink font-medium">Back</button>
                  <button 
                    onClick={handleJoin}
                    disabled={!joinKey1 || !joinKey2}
                    className="terracotta-button flex items-center gap-2 px-12 py-4 text-lg disabled:opacity-50"
                  >
                    Join & Continue <ChevronRight size={20} />
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
                {/* Import Summary Preview */}
                {summary && (
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl shadow-sm">
                    <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Import Preview Summary
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-blue-600/70 tracking-wider">Total Rows</p>
                        <p className="text-2xl font-serif italic text-blue-900">{summary.totalRows}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-blue-600/70 tracking-wider">Unique Items</p>
                        <p className="text-2xl font-serif italic text-blue-900">{summary.uniqueIngredients}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-blue-600/70 tracking-wider">Total Options</p>
                        <p className="text-2xl font-serif italic text-blue-900">{summary.totalOptions}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-blue-600/70 tracking-wider">Skipped Rows</p>
                        <p className="text-2xl font-serif italic text-blue-900">{summary.skipped}</p>
                      </div>
                    </div>
                    {summary.uniqueIngredients < summary.totalRows && summary.uniqueIngredients > 0 && (
                      <div className="mt-4 pt-4 border-t border-blue-100">
                        <p className="text-xs text-blue-700 leading-relaxed">
                          <span className="font-bold">Note:</span> {summary.totalRows - summary.uniqueIngredients} rows have duplicate names and will be grouped as additional weight/price options under their respective ingredients.
                        </p>
                      </div>
                    )}
                  </div>
                )}

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

                <div className="flex flex-col md:flex-row justify-between items-center pt-6 border-t border-gray-100 gap-6">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setStep(importMode === 'dual' ? 'join' : 'input')}
                      className="text-gray-500 hover:text-ink font-medium transition-colors"
                    >
                      Back
                    </button>
                    <label className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl cursor-pointer hover:bg-red-100 transition-all group">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${clearBeforeImport ? 'bg-red-500 border-red-500' : 'bg-white border-red-200 group-hover:border-red-300'}`}>
                        {clearBeforeImport && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                      <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={clearBeforeImport}
                        onChange={(e) => setClearBeforeImport(e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-red-700">Clear existing data before import</span>
                        <span className="text-[10px] text-red-600/70">Recommended to avoid duplicates</span>
                      </div>
                    </label>
                  </div>
                  <button 
                    onClick={handleUpload}
                    disabled={loading || !mappings.name || !mappings.type}
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
                      <span className="text-olive">Processing {importMode === 'dual' ? mergedRows.length : parsedRows.length} rows...</span>
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
            <Database size={18} /> Import Instructions
          </h3>
          <ul className="text-sm text-olive/80 space-y-1 list-disc pl-5">
            {importMode === 'dual' ? (
              <>
                <li>Upload <strong>File 1</strong> containing the basic info (Name, Type, Description).</li>
                <li>Upload <strong>File 2</strong> containing the options (Weight, Price, Nutrition).</li>
                <li>Select the column that exists in both files to link them (usually the Name).</li>
              </>
            ) : (
              <li>Each row represents one <strong>Option</strong> (weight/price) for an ingredient.</li>
            )}
            <li>Rows with the <strong>same Ingredient Name</strong> will be grouped together into a single item with multiple options.</li>
            <li>The <strong>Type</strong> must be one of: Protein, Carb, Veggie, or Base.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BulkCustomMealsImport;
