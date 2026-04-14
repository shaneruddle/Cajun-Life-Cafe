import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db, auth, storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Loader2, 
  Check, 
  X, 
  Receipt, 
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Tag,
  FileText,
  LayoutDashboard,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { FinanceCategory, UserProfile } from '../../types';
import { logActivity } from '../../utils/logger';
import { format } from 'date-fns';

const ExpenseEntry: React.FC = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [extractedData, setExtractedData] = useState<{
    amount: number;
    description: string;
    categoryName: string;
    categoryId: string;
    date: string;
    lineItems: { description: string; amount: number; quantity?: number; weight?: string }[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'finance_categories'), where('type', '==', 'expense'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceCategory[];
      setCategories(cats);
    });

    // Fetch user profile to check role for "Back to Dashboard" button
    if (auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        }
      });
    }

    return () => unsubscribe();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      
      selectedFiles.forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setImages(prev => [...prev, result]);
          
          // Only extract from the first image if none extracted yet
          if (images.length === 0 && !extractedData) {
            extractData(result);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (images.length <= 1) {
      setExtractedData(null);
    }
  };

  const extractData = async (base64Image: string) => {
    setIsExtracting(true);
    setExtractedData(null);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const base64Data = base64Image.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `Extract expense information from this receipt. 
                Available categories: ${categories.map(c => c.name).join(', ')}.
                IMPORTANT: Return all text in English only.
                Return the data in JSON format with the following fields:
                - amount (number, total amount)
                - description (string, overall description in English)
                - categoryName (string, must match one of the available categories if possible, otherwise 'General')
                - date (string, YYYY-MM-DD format, use today if not found)
                - lineItems (array of objects with 'description' (English), 'amount', optional 'quantity', and optional 'weight' (e.g. '500g', '1kg'))
              ` },
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              description: { type: Type.STRING },
              categoryName: { type: Type.STRING },
              date: { type: Type.STRING },
              lineItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    description: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    quantity: { type: Type.NUMBER },
                    weight: { type: Type.STRING }
                  },
                  required: ["description", "amount"]
                }
              }
            },
            required: ["amount", "description", "categoryName", "date", "lineItems"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      
      // Match category ID
      const matchedCategory = categories.find(c => 
        c.name.toLowerCase() === result.categoryName.toLowerCase()
      ) || categories[0];

      setExtractedData({
        ...result,
        categoryId: matchedCategory?.id || '',
        categoryName: matchedCategory?.name || result.categoryName,
        lineItems: result.lineItems || []
      });
      
      toast.success("Receipt info extracted!");
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error("Failed to extract info. Please enter manually.");
      setExtractedData({
        amount: 0,
        description: '',
        categoryName: categories[0]?.name || 'General',
        categoryId: categories[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        lineItems: []
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extractedData || !auth.currentUser || files.length === 0) return;

    setIsSaving(true);
    try {
      const receiptUrls: string[] = [];
      const now = new Date();
      const monthFolder = format(now, 'MMMM yyyy'); // e.g. "April 2026"
      
      // Upload all files to storage
      for (const file of files) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storagePath = `receipts/${monthFolder}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        receiptUrls.push(downloadUrl);
      }

      await addDoc(collection(db, 'finance_entries'), {
        ...extractedData,
        type: 'expense',
        createdBy: auth.currentUser.email,
        uid: auth.currentUser.uid,
        createdAt: now.toISOString(),
        receiptUrls,
        lineItems: extractedData.lineItems
      });
      
      await logActivity('Staff Expense Entry', `Staff entered expense: ${extractedData.description} (฿${extractedData.amount}) with ${files.length} receipt images`, 'finance');
      toast.success("Expense saved successfully!");
      setImages([]);
      setFiles([]);
      setExtractedData(null);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save expense.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream pb-20">
      {/* Mobile-friendly Header */}
      <div className="bg-white px-6 py-8 shadow-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Expense Tracker</h1>
            <p className="text-gray-500 text-sm">Upload receipts to log an expense</p>
          </div>
          {(userProfile?.role === 'admin' || userProfile?.role === 'marketing') && (
            <Link 
              to="/dashboard" 
              className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
              title="Back to Dashboard"
            >
              <LayoutDashboard size={20} />
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        {images.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="aspect-[3/4] bg-white rounded-[40px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-terracotta/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center text-terracotta mb-6">
              <Camera size={40} />
            </div>
            <h2 className="text-xl font-bold text-ink mb-2">Snap or Upload Receipt</h2>
            <p className="text-gray-400 text-sm">We'll automatically extract the details for you</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
              capture="environment"
              multiple
            />
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Images Grid */}
            <div className="grid grid-cols-2 gap-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-md border-2 border-white group">
                  <img src={img} alt={`Receipt ${idx + 1}`} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                  {isExtracting && idx === 0 && (
                    <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                      <Loader2 size={24} className="animate-spin mb-2" />
                      <p className="font-bold tracking-widest uppercase text-[8px]">Extracting...</p>
                    </div>
                  )}
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-[3/4] rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-terracotta/30 hover:text-terracotta transition-all bg-white/50"
              >
                <Plus size={24} className="mb-2" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Add Page</span>
              </button>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
              capture="environment"
              multiple
            />

            {/* Extracted Data Form */}
            <AnimatePresence>
              {extractedData && (
                <motion.form 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleConfirm}
                  className="bg-white rounded-[40px] p-8 shadow-xl border border-gray-100 space-y-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                      <Receipt size={20} />
                    </div>
                    <h3 className="font-bold text-ink">Review Details</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Amount (฿)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">฿</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={extractedData.amount}
                          onChange={(e) => setExtractedData({ ...extractedData, amount: parseFloat(e.target.value) })}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 font-bold text-lg"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Category</label>
                      <div className="relative">
                        <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select 
                          value={extractedData.categoryId}
                          onChange={(e) => {
                            const cat = categories.find(c => c.id === e.target.value);
                            setExtractedData({ 
                              ...extractedData, 
                              categoryId: e.target.value,
                              categoryName: cat?.name || ''
                            });
                          }}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 appearance-none"
                          required
                        >
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Description</label>
                      <div className="relative">
                        <FileText size={18} className="absolute left-4 top-3 text-gray-400" />
                        <textarea 
                          value={extractedData.description}
                          onChange={(e) => setExtractedData({ ...extractedData, description: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 h-24"
                          required
                        />
                      </div>
                    </div>

                    {/* Line Items */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Line Items (Optional)</label>
                        <button 
                          type="button"
                          onClick={() => setExtractedData({
                            ...extractedData,
                            lineItems: [...extractedData.lineItems, { description: '', amount: 0 }]
                          })}
                          className="text-terracotta text-xs font-bold flex items-center gap-1"
                        >
                          <Plus size={14} /> Add Item
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {extractedData.lineItems.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-start">
                            <div className="flex-1 space-y-2">
                              <input 
                                type="text"
                                placeholder="Item description"
                                value={item.description}
                                onChange={(e) => {
                                  const newItems = [...extractedData.lineItems];
                                  newItems[idx].description = e.target.value;
                                  setExtractedData({ ...extractedData, lineItems: newItems });
                                }}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                              />
                              <div className="flex gap-2">
                                <input 
                                  type="number"
                                  placeholder="Qty"
                                  value={item.quantity || ''}
                                  onChange={(e) => {
                                    const newItems = [...extractedData.lineItems];
                                    newItems[idx].quantity = parseFloat(e.target.value);
                                    setExtractedData({ ...extractedData, lineItems: newItems });
                                  }}
                                  className="w-16 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                                />
                                <input 
                                  type="text"
                                  placeholder="Weight"
                                  value={item.weight || ''}
                                  onChange={(e) => {
                                    const newItems = [...extractedData.lineItems];
                                    newItems[idx].weight = e.target.value;
                                    setExtractedData({ ...extractedData, lineItems: newItems });
                                  }}
                                  className="w-24 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                                />
                                <input 
                                  type="number"
                                  placeholder="Amount"
                                  value={item.amount}
                                  onChange={(e) => {
                                    const newItems = [...extractedData.lineItems];
                                    newItems[idx].amount = parseFloat(e.target.value);
                                    setExtractedData({ ...extractedData, lineItems: newItems });
                                  }}
                                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm font-bold"
                                />
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                const newItems = extractedData.lineItems.filter((_, i) => i !== idx);
                                setExtractedData({ ...extractedData, lineItems: newItems });
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 mt-1"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="w-full bg-terracotta text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-terracotta/90 transition-all shadow-lg shadow-terracotta/20 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <>
                        <Check size={20} /> Confirm Expense
                      </>
                    )}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom info for staff */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-center">
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
          Logged in as: {auth.currentUser?.email}
        </p>
      </div>
    </div>
  );
};

export default ExpenseEntry;
