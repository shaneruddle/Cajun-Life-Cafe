import { useState, useEffect } from 'react';
import { collection, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { IngredientPurchase } from './types';
import { Search, Pencil, Trash2, Check, X, Scale } from 'lucide-react';
import { toast } from 'sonner';

export default function Ingredients() {
  const [purchases, setPurchases] = useState<IngredientPurchase[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<Partial<IngredientPurchase>>({});

  useEffect(() => {
    const q = query(collection(db, 'ingredient_purchases'), orderBy('date', 'desc'));
    return onSnapshot(q, snap =>
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })) as IngredientPurchase[])
    );
  }, []);

  const filtered = purchases.filter(p =>
    !search ||
    p.ingredient_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (p: IngredientPurchase) => { setEditingId(p.id); setEditBuf({ ...p }); };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, 'ingredient_purchases', editingId), {
        ingredient_name: editBuf.ingredient_name,
        supplier: editBuf.supplier || '',
        quantity: Number(editBuf.quantity) || 0,
        unit: editBuf.unit || '',
        unit_cost: Number(editBuf.unit_cost) || 0,
        total_cost: Number(editBuf.total_cost) || 0,
        date: editBuf.date,
      });
      setEditingId(null);
      toast.success('Updated');
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    await deleteDoc(doc(db, 'ingredient_purchases', id));
    toast.success('Deleted');
  };

  const totalSpent = filtered.reduce((s, p) => s + (p.total_cost || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ingredients</h1>
          <p className="text-sm text-gray-500 mt-1">Purchase history — auto-populated from Food & Ingredients expenses</p>
        </div>
        {filtered.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total spent</p>
            <p className="text-xl font-bold text-ink">&#3647;{totalSpent.toLocaleString()}</p>
          </div>
        )}
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ingredient or supplier…"
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Scale size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No ingredients yet</p>
          <p className="text-gray-400 text-sm mt-1">Log a Food & Ingredients expense with line items — they'll appear here automatically</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_1fr_100px_100px_100px_80px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span>Ingredient</span>
            <span>Supplier</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit Cost</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <div className="divide-y divide-gray-50">
            {filtered.map(p =>
              editingId === p.id ? (
                <div key={p.id} className="p-4 bg-amber-50 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editBuf.ingredient_name || ''} onChange={e => setEditBuf(b => ({...b, ingredient_name: e.target.value}))} placeholder="Ingredient" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                    <input value={editBuf.supplier || ''} onChange={e => setEditBuf(b => ({...b, supplier: e.target.value}))} placeholder="Supplier" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input value={editBuf.quantity ?? ''} onChange={e => setEditBuf(b => ({...b, quantity: Number(e.target.value)}))} placeholder="Qty" type="number" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                    <input value={editBuf.unit || ''} onChange={e => setEditBuf(b => ({...b, unit: e.target.value}))} placeholder="Unit (kg, g…)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                    <input value={editBuf.unit_cost ?? ''} onChange={e => setEditBuf(b => ({...b, unit_cost: Number(e.target.value)}))} placeholder="Unit cost" type="number" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                    <input value={editBuf.date || ''} onChange={e => setEditBuf(b => ({...b, date: e.target.value}))} type="date" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 py-2 bg-terracotta text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1"><Check size={13} /> Save</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 flex items-center gap-1"><X size={13} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div key={p.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_100px_100px_100px_80px] gap-2 items-center px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{p.ingredient_name}</p>
                    <p className="text-xs text-gray-400">{p.date}</p>
                  </div>
                  <p className="text-sm text-gray-500 hidden md:block">{p.supplier || '—'}</p>
                  <p className="text-sm text-gray-700 text-right hidden md:block">{p.quantity} {p.unit}</p>
                  <p className="text-sm text-right hidden md:block">&#3647;{Number(p.unit_cost).toLocaleString()}<span className="text-xs text-gray-400">/{p.unit}</span></p>
                  <p className="text-sm font-semibold text-right">&#3647;{Number(p.total_cost).toLocaleString()}</p>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-400 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">{filtered.length} purchase{filtered.length !== 1 ? 's' : ''}{search ? ' matching' : ''}</span>
            <span className="font-bold text-ink">&#3647;{totalSpent.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
