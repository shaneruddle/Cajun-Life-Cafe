import { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Income } from './types';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const INCOME_CATEGORIES = ['Food', 'Drinks', 'Meal Preps', 'Catering', 'Other'];

export default function LogIncome({ user }: { user: any }) {
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<Income[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'Food',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'finance_income'), orderBy('created_at', 'desc'), limit(10));
    return onSnapshot(q, snap => setRecent(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Income[]));
  }, []);

  const handleSave = async () => {
    if (!formData.amount || !formData.date) {
      toast.error('Please fill in date and amount');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'finance_income'), {
        date: formData.date,
        category: formData.category,
        amount: parseFloat(formData.amount),
        notes: formData.notes,
        logged_by: user?.email || 'unknown',
        created_at: new Date().toISOString(),
      });
      toast.success('Income logged');
      setFormData(p => ({ ...p, amount: '', notes: '' }));
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => `฿${n.toLocaleString()}`;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-6">Log Income</h1>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta">
              {INCOME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (฿)</label>
            <input type="number" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input type="text" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. busy lunch service" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="mt-6 w-full py-3 bg-terracotta text-white rounded-2xl font-bold hover:bg-terracotta/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Check size={18} /> Log Income</>}
        </button>
      </div>

      {/* Recent entries */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-bold text-ink mb-4">Recent Income</h3>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No income logged yet</p>
        ) : (
          <div className="space-y-3">
            {recent.map(i => (
              <div key={i.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-sm text-ink">{i.category}</p>
                  <p className="text-xs text-gray-400">{i.date}{i.notes ? ` · ${i.notes}` : ''}</p>
                </div>
                <span className="font-bold text-green-600">{fmt(i.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
