import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, query, where, doc, getDoc, updateDoc, serverTimestamp, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth, storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Upload, 
  Loader2, 
  Check, 
  X, 
  Receipt as ReceiptIcon, 
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Tag,
  FileText,
  Plus,
  ArrowDownCircle,
  Star,
  Users,
  Search as SearchIcon,
  Wallet,
  History
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { FinanceCategory, UserProfile, LoyaltyCustomer, LoyaltyTransaction } from '../../types';
import { logActivity } from '../../utils/logger';
import { format } from 'date-fns';
import { sendReceiptSMS } from '../../services/twilioSMS';

const ExpenseEntry: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'expense' | 'loyalty'>('expense');
  
  // Expense State
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

  // Loyalty State
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<LoyaltyCustomer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [allLoyaltyCustomers, setAllLoyaltyCustomers] = useState<LoyaltyCustomer[]>([]);
  const [loyaltyAmount, setLoyaltyAmount] = useState('');
  const [loyaltyMemo, setLoyaltyMemo] = useState('');
  const [loyaltyFile, setLoyaltyFile] = useState<File | null>(null);
  const [loyaltyPreview, setLoyaltyPreview] = useState<string | null>(null);
  const [isExtractingLoyalty, setIsExtractingLoyalty] = useState(false);
  const [extractedItems, setExtractedItems] = useState<{name: string, qty: number, price: number}[]>([]);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemQty, setManualItemQty] = useState('1');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [showManualItemForm, setShowManualItemForm] = useState(false);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loyaltyFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'loyalty') {
      setIsSearching(true);
      // Fetch up to 2000 customers for local search
      const q = query(collection(db, 'loyalty_customers'), limit(2000));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const results = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as LoyaltyCustomer[];
        setAllLoyaltyCustomers(results);
        setIsSearching(false);
      }, (error) => {
        console.error("Loyalty fetch error:", error);
        setIsSearching(false);
        toast.error("Failed to load loyalty members");
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'loyalty') {
      const queryLower = searchQuery.toLowerCase().trim();
      if (!queryLower) {
        setCustomers(allLoyaltyCustomers.slice(0, 10));
        return;
      }
      
      const filtered = allLoyaltyCustomers.filter(c => {
        const mobileValue = (c.mobile || '').toLowerCase();
        const first = (c.firstName || '').toLowerCase();
        const last = (c.lastName || '').toLowerCase();
        const fullName = `${first} ${last}`.trim();
        const customName = ((c as any).name || '').toLowerCase();
        
        return mobileValue.includes(queryLower) || 
               first.includes(queryLower) || 
               last.includes(queryLower) || 
               fullName.includes(queryLower) ||
               customName.includes(queryLower);
      });
      setCustomers(filtered.slice(0, 50));
    }
  }, [searchQuery, allLoyaltyCustomers, activeTab]);

  const logLoyaltyAction = async (actionType: string, details: string, targetMobile: string) => {
    try {
      await addDoc(collection(db, 'system_logs'), {
        timestamp: serverTimestamp(),
        admin_email: auth.currentUser?.email || 'unknown',
        action_type: actionType,
        details: details,
        target_customer_mobile: targetMobile,
        category: 'loyalty'
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  };

  const handleSearch = async () => {
    // Local filtering is handled by useEffect
  };

  const handleLoyaltyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLoyaltyFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setLoyaltyPreview(preview);
        extractLoyaltyData(preview);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractLoyaltyData = async (base64Image: string) => {
    setIsExtractingLoyalty(true);
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              amount: { type: SchemaType.NUMBER },
              merchant: { type: SchemaType.STRING },
              description: { type: SchemaType.STRING },
              items: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    name: { type: SchemaType.STRING },
                    qty: { type: SchemaType.NUMBER },
                    price: { type: SchemaType.NUMBER }
                  },
                  required: ["name", "price"]
                }
              }
            },
            required: ["amount"]
          }
        }
      });

      const base64Data = base64Image.split(',')[1];
      
      const prompt = `Extract all individual items from this receipt including name, quantity, and unit price. 
      Also extract the grand total amount and merchant name.`;
      
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        },
        prompt,
      ]);

      const responseText = result.response.text();
      const extracted = JSON.parse(responseText || '{}');
      
      if (extracted.amount) {
        setLoyaltyAmount(extracted.amount.toString());
        if (extracted.description || extracted.merchant) {
          setLoyaltyMemo(`${extracted.merchant || ''} ${extracted.description || ''}`.trim());
        }
        if (extracted.items && extracted.items.length > 0) {
          setExtractedItems(extracted.items);
          toast.success(`Found ${extracted.items.length} items`);
        } else {
          setExtractedItems([]);
        }
        toast.success(`Extracted: ฿${extracted.amount}`);
      }
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error("Manual entry required.");
    } finally {
      setIsExtractingLoyalty(false);
    }
  };

  const handleProcessLoyalty = async () => {
    if (!selectedCustomer?.id || !loyaltyAmount) return;
    const amount = parseFloat(loyaltyAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    if (amount > selectedCustomer.balance) {
      toast.error('Insufficient balance');
      return;
    }

    setIsSaving(true);
    try {
      let rUrl = '';
      if (loyaltyFile) {
        const timestamp = Date.now();
        const fileName = `loyalty_receipts/${selectedCustomer.id}/${timestamp}_${loyaltyFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, loyaltyFile);
        rUrl = await getDownloadURL(snapshot.ref);
      }

      const newBalance = (selectedCustomer.balance || 0) - amount;
      const customerRef = doc(db, 'loyalty_customers', selectedCustomer.id);
      
      await updateDoc(customerRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(customerRef, 'transactions'), {
        type: 'REDEEM',
        amount: -amount,
        timestamp: serverTimestamp(),
        details: `Receipt processed (฿${amount})`,
        memo: loyaltyMemo,
        receiptUrl: rUrl,
        items: extractedItems
      });

      await logLoyaltyAction('Receipt Processed (Staff Portal)', `Deducted ฿${amount} from ${selectedCustomer.mobile}`, selectedCustomer.mobile);
      
      try {
        await sendReceiptSMS(selectedCustomer.id, amount, newBalance);
      } catch (smsErr) {
        console.error('Failed to send SMS:', smsErr);
      }

      toast.success(`฿${amount} processed successfully!`);
      setLoyaltyAmount('');
      setLoyaltyMemo('');
      setLoyaltyFile(null);
      setLoyaltyPreview(null);
      setExtractedItems([]);
      setSelectedCustomer(null);
      setSearchQuery('');
    } catch (error) {
      console.error("Process error:", error);
      toast.error("Processing failed");
    } finally {
      setIsSaving(false);
    }
  };

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
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const base64Data = base64Image.split(',')[1];
      
      const response = await model.generateContent([
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        },
        `Extract expense information from this receipt. 
        Available categories: ${categories.map(c => c.name).join(', ')}.
        IMPORTANT: Return all text in English only.
        Return the data in JSON format (must be valid JSON, no markdown blocks) with the following fields:
        - amount (number, total amount)
        - description (string, overall description in English)
        - categoryName (string, must match one of the available categories if possible, otherwise 'General')
        - date (string, YYYY-MM-DD format, use today if not found)
        - lineItems (array of objects with 'description' (English), 'amount', optional 'quantity', and optional 'weight' (e.g. '500g', '1kg'))`
      ]);

      const text = response.response.text().replace(/```json|```/g, '').trim();
      const result = JSON.parse(text || '{}');
      
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
      <div className="bg-white px-6 pt-8 shadow-sm border-b border-gray-100 sticky top-0 z-10 space-y-4">
        <div className="flex justify-between items-start mb-1">
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Staff Portal</h1>
            <p className="text-gray-500 text-sm">Manage restaurant tasks</p>
          </div>
          {(userProfile?.role === 'admin' || userProfile?.role === 'marketing' || userProfile?.role === 'cashier') && (
            <Link 
              to="/dashboard" 
              className="p-2 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
              title="Dashboard"
            >
              <LayoutDashboard size={20} />
            </Link>
          )}
        </div>

          <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('expense')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'expense' ? 'bg-white shadow-sm text-terracotta' : 'text-gray-400 hover:text-ink'
            }`}
          >
            <ReceiptIcon size={16} /> Expense Logger
          </button>
          <button 
            onClick={() => setActiveTab('loyalty')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'loyalty' ? 'bg-white shadow-sm text-terracotta' : 'text-gray-400 hover:text-ink'
            }`}
          >
            <Star size={16} /> Loyalty Pay
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto p-6 space-y-6">
        {activeTab === 'expense' ? (
          images.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="aspect-[3/4] bg-white rounded-[40px] border-4 border-dashed border-gray-100 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:border-terracotta/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center text-terracotta mb-6">
                <Camera size={40} />
              </div>
              <h2 className="text-xl font-bold text-ink mb-2">Snap Expense Receipt</h2>
              <p className="text-gray-400 text-sm">Automated extraction for bookkeeping</p>
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
                        <ReceiptIcon size={20} />
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
                                  if (extractedData) {
                                    const newItems = extractedData.lineItems.filter((_, i) => i !== idx);
                                    setExtractedData({ ...extractedData, lineItems: newItems });
                                  }
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
          )
        ) : (
          /* LOYALTY TAB */
          <div className="space-y-6">
            {!selectedCustomer ? (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Search member by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-terracotta/20 font-medium"
                  />
                </div>

                <div className="space-y-2">
                  {isSearching && (
                    <div className="text-center py-8">
                      <Loader2 className="animate-spin mx-auto text-terracotta" />
                    </div>
                  )}
                  {customers.map(c => (
                    <motion.div 
                      key={c.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedCustomer(c);
                        fetchTransactions(c.id);
                      }}
                      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-terracotta/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-terracotta/10 rounded-full flex items-center justify-center text-terracotta font-bold">
                          {c.firstName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-ink">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-500">{c.mobile}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-ink">฿{c.balance.toLocaleString()}</p>
                        <p className="text-[8px] uppercase tracking-widest text-gray-400 font-bold">Balance</p>
                      </div>
                    </motion.div>
                  ))}
                  {searchQuery.length >= 3 && customers.length === 0 && !isSearching && (
                    <p className="text-center py-8 text-gray-400 text-sm italic">No members found</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selected Member Header */}
                <div className="bg-ink p-6 rounded-3xl text-white relative overflow-hidden shadow-xl">
                  <div className="flex items-center gap-4 mb-4 relative z-10">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center font-bold text-xl">
                      {selectedCustomer.firstName?.[0] || 'U'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{selectedCustomer.firstName} {selectedCustomer.lastName}</h3>
                      <p className="text-white/60 text-sm">{selectedCustomer.mobile}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedCustomer(null);
                        setTransactions([]);
                      }}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="relative z-10 flex justify-between items-end">
                    <div>
                      <p className="text-white/40 text-[10px] uppercase font-bold tracking-[0.2em] mb-1">Cajun Wallet Balance</p>
                      <p className="text-3xl font-display font-bold">฿{selectedCustomer.balance.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Advanced Process Receipt Form */}
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="text-terracotta" size={20} />
                    <h3 className="font-bold text-ink">Process Payment</h3>
                  </div>

                  <div 
                    onClick={() => loyaltyFileInputRef.current?.click()}
                    className={`aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden ${
                      loyaltyPreview ? 'border-olive/30 bg-olive/5' : 'border-gray-100 hover:border-terracotta/30 hover:bg-terracotta/5'
                    }`}
                  >
                    {loyaltyPreview ? (
                      <div className="relative w-full h-full group">
                        <img src={loyaltyPreview} alt="Receipt" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <span className="text-xs font-bold uppercase tracking-widest">Change Photo</span>
                        </div>
                        {isExtractingLoyalty && (
                          <div className="absolute inset-0 bg-ink/60 flex flex-col items-center justify-center text-white">
                            <Loader2 className="animate-spin mb-2" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Scanning...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-terracotta/10 rounded-full flex items-center justify-center text-terracotta mb-2">
                          <Camera size={24} />
                        </div>
                        <span className="text-sm font-bold">Scan Member Receipt</span>
                      </>
                    )}
                  </div>

                  <input 
                    type="file"
                    ref={loyaltyFileInputRef}
                    onChange={handleLoyaltyFileChange}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5 ml-1">Receipt Total (฿)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">฿</span>
                        <input 
                          type="number"
                          value={loyaltyAmount}
                          onChange={(e) => setLoyaltyAmount(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-xl"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1.5 ml-1">Reference</label>
                      <input 
                        type="text"
                        value={loyaltyMemo}
                        onChange={(e) => setLoyaltyMemo(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm"
                        placeholder="Table / Order #"
                      />
                    </div>
                  </div>

                  {/* Itemized Details Section copied from LoyaltyDashboard logic */}
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                     <div className="flex justify-between items-center px-1">
                       <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Itemized Details</h4>
                       <button 
                         onClick={() => setShowManualItemForm(true)}
                         className="text-[10px] font-bold text-olive hover:text-olive/80 transition-colors flex items-center gap-1"
                       >
                         <Plus size={10} /> Add Item
                       </button>
                     </div>
                     
                     <div className="max-h-40 overflow-auto space-y-1">
                       {extractedItems.length > 0 ? (
                          extractedItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs group py-1 first:pt-0">
                              <span className="text-ink truncate pr-2 flex-1">{item.qty || 1}x {item.name}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500 font-mono italic">฿{item.price.toLocaleString()}</span>
                                <button 
                                  onClick={() => setExtractedItems(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-gray-400 hover:text-terracotta transition-colors"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))
                       ) : (
                         <button 
                           onClick={() => setShowManualItemForm(true)}
                           className="w-full py-4 border-2 border-dashed border-gray-100 rounded-xl text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:bg-white transition-all flex flex-col items-center gap-1"
                         >
                           <Plus size={16} />
                           No items detected. Add manually?
                         </button>
                       )}
                     </div>

                     {showManualItemForm && (
                       <div className="mt-4 p-4 bg-white rounded-xl border border-terracotta/10 shadow-sm space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                             <div className="col-span-2">
                                <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 ml-1">Name</label>
                                <input 
                                  placeholder="e.g. Burger" 
                                  className="w-full text-xs p-2 bg-gray-50 rounded-lg outline-none border border-transparent focus:border-terracotta/20" 
                                  value={manualItemName}
                                  onChange={(e) => setManualItemName(e.target.value)}
                                />
                             </div>
                             <div>
                                <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 ml-1">Qty</label>
                                <input 
                                  placeholder="1" 
                                  type="number" 
                                  className="w-full text-xs p-2 bg-gray-50 rounded-lg outline-none border border-transparent focus:border-terracotta/20"
                                  value={manualItemQty}
                                  onChange={(e) => setManualItemQty(e.target.value)}
                                />
                             </div>
                             <div>
                                <label className="block text-[8px] font-bold text-gray-400 uppercase mb-1 ml-1">Price</label>
                                <input 
                                  placeholder="0" 
                                  type="number" 
                                  className="w-full text-xs p-2 bg-gray-50 rounded-lg outline-none border border-transparent focus:border-terracotta/20"
                                  value={manualItemPrice}
                                  onChange={(e) => setManualItemPrice(e.target.value)}
                                />
                             </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                             <button 
                               onClick={addManualItem}
                               className="flex-1 py-2 bg-terracotta text-white text-[10px] font-bold rounded-lg uppercase shadow-sm active:scale-95 transition-transform"
                              >
                               Confirm Item
                             </button>
                             <button 
                               onClick={() => setShowManualItemForm(false)}
                               className="px-3 py-2 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg uppercase"
                              >
                               Cancel
                             </button>
                          </div>
                       </div>
                     )}
                  </div>

                  <button 
                    onClick={handleProcessLoyalty}
                    disabled={isSaving || isExtractingLoyalty || !loyaltyAmount || parseFloat(loyaltyAmount) > selectedCustomer.balance}
                    className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-terracotta/20 disabled:opacity-50 transition-all hover:bg-terracotta/90"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin" />
                    ) : isExtractingLoyalty ? (
                      <span className="flex items-center gap-2 italic">Scanning...</span>
                    ) : (
                      <>
                        <ArrowDownCircle size={20} /> Process & Deduct
                      </>
                    )}
                  </button>
                  
                  {loyaltyAmount && parseFloat(loyaltyAmount) > selectedCustomer.balance && (
                    <p className="text-center text-terracotta text-[10px] font-bold uppercase tracking-widest">Insufficient Wallet Balance</p>
                  )}
                </div>

                {/* Transaction History for Member */}
                {transactions.length > 0 && (
                  <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <History size={18} className="text-gray-400" />
                      <h4 className="font-bold text-ink">Member History</h4>
                    </div>
                    <div className="space-y-3 max-h-60 overflow-auto pr-1">
                      {transactions.map(tx => (
                        <div key={tx.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center text-xs">
                          <div>
                            <div className="font-bold text-ink flex items-center gap-1">
                              {tx.type === 'TOP_UP' ? (
                                <Plus size={12} className="text-green-600" />
                              ) : (
                                <ArrowDownCircle size={12} className="text-terracotta" />
                              )}
                              {tx.type}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {(tx.timestamp as any)?.toDate?.()?.toLocaleDateString() || 'Just now'}
                            </div>
                          </div>
                          <div className={`font-mono font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-terracotta'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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
