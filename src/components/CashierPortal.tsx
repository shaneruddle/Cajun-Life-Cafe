import { useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection, addDoc, query, where, orderBy, onSnapshot, doc, getDoc, setDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { logActivity } from '../utils/logger';
import {
  LogIn, LogOut, Camera, Upload, Loader2, Check, Trash2, Plus,
  ClipboardList, X, ChevronDown, AlertCircle, RefreshCw,
  Pencil, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseItem } from './finance/types';
const _BUILD = '2026-06-03 08:24:51 UTC - 2026-06-03 07:54:51 UTC'; // forces bundle rehash

const EXPENSE_CATEGORIES = [
  { id: 'food',       name: 'Food & Ingredients' },
  { id: 'drinks',     name: 'Drinks & Beverages' },
  { id: 'packaging',  name: 'Packaging' },
  { id: 'utilities',  name: 'Utilities' },
  { id: 'staff',      name: 'Staff' },
  { id: 'equipment',  name: 'Equipment' },
  { id: 'rent',       name: 'Rent' },
  { id: 'other',      name: 'Other' },
];

// ── Login Screen ───────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter your email and password'); return; }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      // Check Firestore role
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        toast.error('Account not set up. Contact your manager.');
        await signOut(auth); setLoading(false); return;
      }
      const data = snap.data();
      if (!['cashier', 'manager', 'admin'].includes(data.role)) {
        toast.error('You do not have cashier access. Contact your manager.');
        await signOut(auth); setLoading(false); return;
      }
      // Update lastLogin
      await setDoc(doc(db, 'users', cred.user.uid), { lastLogin: new Date().toISOString() }, { merge: true });
      onLogin({ ...data, uid: cred.user.uid });
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        toast.error('Incorrect email or password');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Try again in a few minutes.');
      } else {
        toast.error('Login failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { toast.error('Enter your email first'); return; }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Password reset email sent — check your inbox');
      setShowReset(false);
    } catch {
      toast.error('Could not send reset email. Check the email address.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-terracotta to-terracotta/80 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-4">
            <span className="text-4xl">🍛</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Cajun Life Cafe</h1>
          <p className="text-white/70 mt-1 text-sm">Staff Expense Portal</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-3xl p-8 shadow-2xl space-y-5">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 -mt-3">Use your personal email and password</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email" autoComplete="email" inputMode="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password" autoComplete="current-password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg hover:bg-terracotta/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
          >
            {loading ? <><Loader2 size={20} className="animate-spin" /> Signing in…</> : <><LogIn size={20} /> Sign In</>}
          </button>

          <button type="button" onClick={() => setShowReset(!showReset)}
            className="w-full text-center text-sm text-gray-400 hover:text-terracotta transition-colors pt-1"
          >
            Forgot password?
          </button>

          {showReset && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm text-amber-700 mb-3">We'll send a reset link to the email above.</p>
              <button type="button" onClick={handleReset} disabled={resetting}
                className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {resetting ? <Loader2 size={16} className="animate-spin" /> : null}
                Send Reset Email
              </button>
            </div>
          )}
        </form>

        <p className="text-center text-white/50 text-xs mt-8">
          Don't have an account? Ask your manager to set one up.
        </p>
      </div>
    </div>
  );
}

// ── Today's Summary Sheet ──────────────────────────────────────────────────────
function TodaySummary({ open, onClose, user }: { open: boolean; onClose: () => void; user: any }) {
  const [expenses, setExpenses] = useState<any[]>([]);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    const q = query(
      collection(db, 'finance_expenses'),
      where('date', '==', today),
      orderBy('created_at', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [open]);

  const total = expenses.reduce((s, e) => s + (e.total || 0), 0);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editTotal, setEditTotal] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await import('firebase/firestore').then(({ deleteDoc, doc }) =>
        deleteDoc(doc(db, 'finance_expenses', id))
      );
      toast.success('Expense deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleEditSave = async () => {
    if (!editingExpense) return;
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'finance_expenses', editingExpense.id), {
        total:    parseFloat(editTotal) || 0,
        supplier: editSupplier,
        notes:    editNotes,
      });
      toast.success('Expense updated');
      setEditingExpense(null);
    } catch { toast.error('Failed to update'); }
  };
  const byCategory: Record<string, number> = {};
  expenses.forEach(e => {
    byCategory[e.category_name] = (byCategory[e.category_name] || 0) + (e.total || 0);
  });
  const fmt = (n: number) => `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="mt-auto bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Today's Expenses</h2>
            <p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No expenses logged today yet.</p>
            </div>
          ) : (
            expenses.map(e => (
              <div key={e.id} className="bg-gray-50 rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full">
                        {e.category_name}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900 mt-1 truncate">{e.supplier || 'No supplier'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">by {e.logged_by} · {e.created_at ? new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 shrink-0">
                    <p className="font-bold text-gray-900 text-lg">{fmt(e.total || 0)}</p>
                    <button onClick={() => { setEditingExpense(e); setEditTotal(String(e.total || '')); setEditSupplier(e.supplier || ''); setEditNotes(e.notes || ''); }}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(e.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Category breakdown */}
        {expenses.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">By Category</p>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-gray-600">{cat}</span>
                <span className="font-semibold text-gray-900">{fmt(amt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Edit modal */}
        {editingExpense && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setEditingExpense(null)}>
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-gray-900">Edit Expense</h3>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</label>
                <input value={editSupplier} onChange={e => setEditSupplier(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-terracotta" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount (฿)</label>
                <input type="number" value={editTotal} onChange={e => setEditTotal(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-terracotta" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
                <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-terracotta" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingExpense(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
                <button onClick={handleEditSave}
                  className="flex-1 py-3 rounded-xl bg-terracotta text-white font-semibold text-sm">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Grand total */}
        <div className="px-6 py-5 bg-gray-900 rounded-t-none" style={{ borderRadius: '0 0 0 0' }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total expenses today</p>
              <p className="text-xs text-gray-500 mt-0.5">{expenses.length} receipt{expenses.length !== 1 ? 's' : ''} logged</p>
            </div>
            <p className="text-3xl font-bold text-white">{fmt(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Expense Form ───────────────────────────────────────────────────────────────
function ExpenseForm({ user }: { user: any }) {
  const [step, setStep]             = useState<'capture' | 'review' | 'saving' | 'done'>('capture');
  const [imageFile, setImageFile]   = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning]     = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    date:          new Date().toISOString().slice(0, 10),
    supplier:      '',
    category_id:   'food',
    category_name: 'Food & Ingredients',
    total:         '',
    notes:         '',
    items:         [] as ExpenseItem[],
  });

  // Live today's expense count for badge
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const q = query(collection(db, 'finance_expenses'), where('date', '==', today));
    return onSnapshot(q, snap => setTodayCount(snap.size));
  }, []);

  const reset = () => {
    setStep('capture');
    setImageFile(null);
    setImagePreview(null);
    setFormData({
      date: new Date().toISOString().slice(0, 10),
      supplier: '', category_id: 'food', category_name: 'Food & Ingredients',
      total: '', notes: '', items: [],
    });
  };

  const handleImageSelected = async (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setStep('review');
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
          date:     d.date    || prev.date,
          total:    d.total   ? String(d.total) : prev.total,
          items:    (d.items || []).map((item: any) => ({
            description: item.description || '',
            quantity:    item.quantity,
            unit:        item.unit || '',
            unit_price:  item.unit_price,
            total_price: item.total_price,
          })),
        }));
        toast.success('Receipt scanned ✓');
      } else {
        toast.error('Could not read receipt — fill in manually');
      }
    } catch {
      toast.error('Scan failed — fill in manually');
    } finally {
      setScanning(false);
    }
  };

  const handleCategoryChange = (id: string) => {
    const cat = EXPENSE_CATEGORIES.find(c => c.id === id);
    setFormData(prev => ({ ...prev, category_id: id, category_name: cat?.name || id }));
  };

  const addItem    = () => setFormData(p => ({ ...p, items: [...p.items, { description: '', quantity: null, unit: '', unit_price: null, total_price: null }] }));
  const removeItem = (i: number) => setFormData(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: keyof ExpenseItem, val: any) =>
    setFormData(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));

  const handleSave = async () => {
    if (!formData.total || !formData.date) { toast.error('Fill in date and total amount'); return; }
    setStep('saving');
    try {
      let receipt_url = '';
      if (imageFile) {
        const storageRef = ref(storage, `receipts/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        receipt_url = await getDownloadURL(storageRef);
      }
      await addDoc(collection(db, 'finance_expenses'), {
        date:          formData.date,
        supplier:      formData.supplier,
        category_id:   formData.category_id,
        category_name: formData.category_name,
        total:         parseFloat(formData.total),
        currency:      'THB',
        items:         formData.items,
        receipt_url,
        notes:         formData.notes,
        logged_by:     user?.email || 'unknown',
        created_at:    new Date().toISOString(),
      });
      await logActivity(
        'Expense Logged (Cashier Portal)',
        `฿${parseFloat(formData.total).toLocaleString()} · ${formData.category_name} · ${formData.supplier || 'no supplier'} · ${formData.date}`,
        'finance'
      );
      setStep('done');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save');
      setStep('review');
    }
  };

  // ── Done screen ──
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
          <Check size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Expense Saved!</h2>
        <p className="text-gray-500 mb-8">฿{parseFloat(formData.total || '0').toLocaleString()} logged successfully.</p>
        <button onClick={reset}
          className="w-full max-w-xs py-4 bg-terracotta text-white rounded-2xl font-bold text-lg hover:bg-terracotta/90 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Plus size={20} /> Log Another
        </button>
        <button onClick={() => setShowSummary(true)}
          className="w-full max-w-xs py-4 mt-3 border-2 border-gray-200 text-gray-700 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <ClipboardList size={20} /> View Today's Summary
        </button>
        <TodaySummary open={showSummary} onClose={() => setShowSummary(false)} user={user} />
      </div>
    );
  }

  // ── Capture screen ──
  if (step === 'capture') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="font-bold text-gray-900 text-lg leading-tight">Log Expense</h1>
            <p className="text-xs text-gray-400">Hi {user?.displayName || user?.email?.split('@')[0]}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSummary(true)} className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <ClipboardList size={20} className="text-gray-600" />
              {todayCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-terracotta text-white text-xs font-bold flex items-center justify-center">
                  {todayCount}
                </span>
              )}
            </button>
            <button onClick={() => signOut(auth)} className="p-2 rounded-full bg-gray-100 hover:bg-red-50 hover:text-red-500 transition-colors text-gray-500">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 max-w-md mx-auto">
          <p className="text-gray-500 text-sm mb-6">Take a photo of your receipt or upload from your gallery.</p>

          <button onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 py-7 bg-terracotta text-white rounded-3xl text-xl font-bold hover:bg-terracotta/90 transition-all shadow-xl mb-4"
          >
            <Camera size={28} /> Take Photo
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-3 py-5 border-2 border-gray-200 text-gray-700 rounded-3xl text-lg font-semibold hover:bg-gray-50 transition-all mb-4"
          >
            <Upload size={22} /> Upload from Gallery
          </button>

          <button onClick={() => setStep('review')}
            className="w-full py-4 border border-dashed border-gray-300 rounded-2xl text-gray-400 text-sm hover:border-terracotta hover:text-terracotta transition-all"
          >
            Enter manually (no receipt)
          </button>
        </div>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />

        <TodaySummary open={showSummary} onClose={() => setShowSummary(false)} user={user} />
      </div>
    );
  }

  // ── Review / form screen ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={reset} className="text-terracotta font-semibold text-sm flex items-center gap-1 px-3 py-3 -ml-3 rounded-xl active:bg-terracotta/10">
          ← Back
        </button>
        <h1 className="font-bold text-gray-900">Review Expense</h1>
        {scanning ? (
          <span className="text-xs text-terracotta flex items-center gap-1 font-medium">
            <Loader2 size={12} className="animate-spin" /> Scanning…
          </span>
        ) : <div className="w-16" />}
      </div>

      <div className="p-5 max-w-md mx-auto pb-32">
        {/* Receipt preview */}
        {imagePreview && (
          <div className="mb-5 relative">
            <img
              src={imagePreview} alt="Receipt"
              onClick={() => setLightbox(true)}
              className="w-full max-h-44 object-contain rounded-2xl border border-gray-200 bg-gray-50 cursor-zoom-in"
            />
            {scanning && (
              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center">
                <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold text-terracotta">
                  <Loader2 size={16} className="animate-spin" /> Reading receipt…
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lightbox */}
        {lightbox && imagePreview && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
          >
            <img src={imagePreview} alt="Receipt full size" className="max-w-full max-h-full rounded-xl object-contain" />
            <button
              onClick={() => setLightbox(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label>
            <input type="date" value={formData.date}
              onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta bg-white"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Supplier / Shop</label>
            <input type="text" value={formData.supplier}
              onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))}
              placeholder="e.g. Makro, Local market"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta bg-white"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
            <div className="relative">
              <select value={formData.category_id} onChange={e => handleCategoryChange(e.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta bg-white appearance-none pr-10"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Total — big and prominent */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Amount (฿)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">฿</span>
              <input type="number" inputMode="decimal" value={formData.total}
                onChange={e => setFormData(p => ({ ...p, total: e.target.value }))}
                placeholder="0.00"
                className="w-full border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-4 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent bg-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
            <input type="text" value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any extra details"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta bg-white"
            />
          </div>

          {/* Line items (collapsible) */}
          <details className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <summary className="px-4 py-3.5 text-sm font-semibold text-gray-700 cursor-pointer flex items-center justify-between list-none">
              <span>Line items ({formData.items.length})</span>
              <ChevronDown size={16} className="text-gray-400" />
            </summary>
            <div className="px-4 pb-4 border-t border-gray-100">
              {formData.items.length === 0 ? (
                <p className="text-gray-400 text-sm italic text-center py-4">No items — add them or they'll be extracted from the receipt.</p>
              ) : (
                <div className="space-y-2 mt-3">
                  {formData.items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                        placeholder="Item" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta" />
                      <input type="number" value={item.total_price ?? ''} onChange={e => updateItem(i, 'total_price', e.target.value ? parseFloat(e.target.value) : null)}
                        placeholder="฿" className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-terracotta" />
                      <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={addItem} className="mt-3 text-terracotta text-sm font-semibold flex items-center gap-1 hover:underline">
                <Plus size={14} /> Add item
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <button onClick={handleSave} disabled={step === 'saving' || scanning}
          className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg hover:bg-terracotta/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
        >
          {step === 'saving' ? <><Loader2 size={20} className="animate-spin" /> Saving…</> : <><Check size={20} /> Save Expense</>}
        </button>
      </div>
    </div>
  );
}

// ── Main Cashier Portal ────────────────────────────────────────────────────────
export default function CashierPortal() {
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (['cashier', 'manager', 'admin'].includes(data.role)) {
            setUser({ ...data, uid: firebaseUser.uid });
          } else {
            await signOut(auth);
            setUser(null);
          }
        } else {
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-terracotta to-terracotta/80 flex items-center justify-center">
        <Loader2 size={40} className="text-white animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  return <ExpenseForm user={user} />;
}
