import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { ExpenseItem } from './types';
import { Camera, Upload, Loader2, Check, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

const EXPENSE_CATEGORIES = [
  { id: 'food', name: 'Food & Ingredients' },
  { id: 'drinks', name: 'Drinks & Beverages' },
  { id: 'packaging', name: 'Packaging' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'staff', name: 'Staff' },
  { id: 'equipment', name: 'Equipment' },
  { id: 'rent', name: 'Rent' },
  { id: 'other', name: 'Other' },
];

export default function LogExpense({ user }: { user: any }) {
  const [step, setStep] = useState<'capture' | 'review' | 'saving'>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplier: '',
    category_id: 'food',
    category_name: 'Food & Ingredients',
    total: '',
    notes: '',
    items: [] as ExpenseItem[],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelected = async (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setStep('review');
    // Auto-scan
    await scanReceipt(file);
  };

  const scanReceipt = async (file: File) => {
    setScanning(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });

      const response = await fetch('/api/ocr-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });

      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        setFormData(prev => ({
          ...prev,
          supplier: d.supplier || prev.supplier,
          date: d.date || prev.date,
          total: d.total ? String(d.total) : prev.total,
          items: (d.items || []).map((item: any) => ({
            description: item.description || '',
            quantity: item.quantity,
            unit: item.unit || '',
            unit_price: item.unit_price,
            total_price: item.total_price,
          })),
        }));
        toast.success('Receipt scanned successfully');
      } else {
        toast.error('Could not read receipt — please fill in manually');
      }
    } catch (err) {
      toast.error('Scan failed — please fill in manually');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (idx: number, field: keyof ExpenseItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: null, unit: '', unit_price: null, total_price: null }],
    }));
  };

  const removeItem = (idx: number) => {
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleCategoryChange = (id: string) => {
    const cat = EXPENSE_CATEGORIES.find(c => c.id === id);
    setFormData(prev => ({ ...prev, category_id: id, category_name: cat?.name || id }));
  };

  const handleSave = async () => {
    if (!formData.total || !formData.date) {
      toast.error('Please fill in date and total amount');
      return;
    }
    setStep('saving');
    try {
      let receipt_url = '';
      if (imageFile) {
        const storageRef = ref(storage, `receipts/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        receipt_url = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, 'finance_expenses'), {
        date: formData.date,
        supplier: formData.supplier,
        category_id: formData.category_id,
        category_name: formData.category_name,
        total: parseFloat(formData.total),
        currency: 'THB',
        items: formData.items,
        receipt_url,
        notes: formData.notes,
        logged_by: user?.email || 'unknown',
        created_at: new Date().toISOString(),
      });

      toast.success('Expense logged successfully');
      // Reset
      setStep('capture');
      setImageFile(null);
      setImagePreview(null);
      setFormData({
        date: new Date().toISOString().slice(0, 10),
        supplier: '',
        category_id: 'food',
        category_name: 'Food & Ingredients',
        total: '',
        notes: '',
        items: [],
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to save expense');
      setStep('review');
    }
  };

  if (step === 'capture') {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-ink mb-2">Log Expense</h1>
        <p className="text-gray-500 text-sm mb-8">Take a photo of your receipt or upload one to automatically extract the details.</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-8 bg-terracotta text-white rounded-2xl hover:bg-terracotta/90 transition-all shadow-lg">
            <Camera size={32} />
            <span className="font-bold">Take Photo</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 p-8 bg-cream text-ink rounded-2xl hover:bg-gray-100 transition-all border-2 border-gray-200">
            <Upload size={32} />
            <span className="font-bold">Upload</span>
          </button>
        </div>

        <button onClick={() => setStep('review')} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-400 hover:border-terracotta hover:text-terracotta transition-all text-sm font-medium">
          Skip scanning — enter manually
        </button>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Review Expense</h1>
        {scanning && (
          <div className="flex items-center gap-2 text-terracotta text-sm font-medium">
            <Loader2 size={16} className="animate-spin" /> Scanning receipt...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Receipt preview */}
        {imagePreview && (
          <div className="md:col-span-2">
            <img src={imagePreview} alt="Receipt" className="w-full max-h-48 object-contain rounded-2xl border border-gray-200 bg-gray-50" />
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        {/* Supplier */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <input type="text" value={formData.supplier} onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))} placeholder="e.g. Makro, local market" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select value={formData.category_id} onChange={e => handleCategoryChange(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta">
            {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Total */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total (฿)</label>
          <input type="number" value={formData.total} onChange={e => setFormData(p => ({ ...p, total: e.target.value }))} placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input type="text" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional notes" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
        </div>
      </div>

      {/* Line items */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-ink">Line Items</h3>
          <button onClick={addItem} className="flex items-center gap-1 text-terracotta text-sm font-medium hover:underline">
            <Plus size={14} /> Add item
          </button>
        </div>

        {formData.items.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-4">No line items — add them above or they'll be extracted from your receipt.</p>
        ) : (
          <div className="space-y-3">
            {formData.items.map((item, idx) => (
              <div key={idx} className="bg-gray-50 rounded-xl p-4 grid grid-cols-12 gap-2 items-center">
                <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" className="col-span-5 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta" />
                <input type="number" value={item.quantity ?? ''} onChange={e => updateItem(idx, 'quantity', e.target.value ? parseFloat(e.target.value) : null)} placeholder="Qty" className="col-span-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta" />
                <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} placeholder="Unit" className="col-span-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta" />
                <input type="number" value={item.total_price ?? ''} onChange={e => updateItem(idx, 'total_price', e.target.value ? parseFloat(e.target.value) : null)} placeholder="฿" className="col-span-2 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta" />
                <button onClick={() => removeItem(idx)} className="col-span-1 text-gray-400 hover:text-red-500 transition-colors flex justify-center">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        <button onClick={() => setStep('capture')} className="flex-1 py-3 border border-gray-200 rounded-2xl text-gray-600 font-medium hover:bg-gray-50 transition-all">
          Back
        </button>
        <button onClick={handleSave} disabled={step === 'saving'} className="flex-2 flex-grow-[2] py-3 bg-terracotta text-white rounded-2xl font-bold hover:bg-terracotta/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {step === 'saving' ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Check size={18} /> Save Expense</>}
        </button>
      </div>
    </div>
  );
}
