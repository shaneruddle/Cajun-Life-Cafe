import { useState, useEffect } from 'react';
import { collection, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { IngredientPurchase } from './types';
import { Search, Pencil, Trash2, Check, X, Scale, Image, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';

const INPUT_CLS = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta';
const LBL_CLS = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';

const isWeightUnit = (u: string) => ['g', 'kg', 'ml', 'l'].includes((u || '').toLowerCase());

const computePurchase = (qtyRaw: any, unit: string, sizeEachRaw: any, sizeUnit: string, totalPaidRaw: any) => {
  const qty = Number(qtyRaw) || 0;
  const sizeEach = Number(sizeEachRaw) || 0;
  const totalPaid = Number(totalPaidRaw) || 0;
  let quantity = qty;
  let finalUnit = (unit || 'pcs').trim();
  if (!isWeightUnit(finalUnit) && sizeEach > 0) {
    quantity = qty * sizeEach;
    finalUnit = sizeUnit;
  }
  const unit_cost = quantity > 0 ? Math.round((totalPaid / quantity) * 10000) / 10000 : 0;
  return { quantity, unit: finalUnit, unit_cost, total_cost: totalPaid };
};

const previewText = (buf: any) => {
  const c = computePurchase(buf.qty, buf.unit, buf.sizeEach, buf.sizeUnit || 'g', buf.totalPaid);
  if (!c.quantity || !c.total_cost) return '';
  const per = c.unit_cost < 10 ? c.unit_cost.toFixed(2) : c.unit_cost.toLocaleString();
  return 'You bought ' + c.quantity.toLocaleString() + ' ' + c.unit + ' for \u0E3F' + c.total_cost.toLocaleString() + ' (\u0E3F' + per + ' per ' + c.unit + ')';
};

const UNIT_OPTIONS = ['pack', 'pcs', 'bottle', 'can', 'box', 'kg', 'g', 'L', 'ml'];

function PurchaseFields({ buf, set }: { buf: any; set: (field: string, value: any) => void }) {
  const countUnit = !isWeightUnit(buf.unit);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LBL_CLS}>How many did you buy?</label>
          <input type="number" value={buf.qty ?? ''} onChange={e => set('qty', e.target.value)} placeholder="e.g. 4" className={INPUT_CLS} />
        </div>
        <div>
          <label className={LBL_CLS}>Of what?</label>
          <select value={buf.unit} onChange={e => set('unit', e.target.value)} className={INPUT_CLS}>
            {buf.unit && !UNIT_OPTIONS.includes(buf.unit) ? <option value={buf.unit}>{buf.unit}</option> : null}
            {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>
      {countUnit && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LBL_CLS}>Size of each one (optional)</label>
            <input type="number" value={buf.sizeEach ?? ''} onChange={e => set('sizeEach', e.target.value)} placeholder="e.g. 500" className={INPUT_CLS} />
          </div>
          <div>
            <label className={LBL_CLS}>g or ml</label>
            <select value={buf.sizeUnit || 'g'} onChange={e => set('sizeUnit', e.target.value)} className={INPUT_CLS}>
              <option value="g">g (grams)</option>
              <option value="ml">ml</option>
            </select>
          </div>
        </div>
      )}
      <div>
        <label className={LBL_CLS}>Total paid (฿) — from the receipt</label>
        <input type="number" value={buf.totalPaid ?? ''} onChange={e => set('totalPaid', e.target.value)} placeholder="e.g. 1316" className={INPUT_CLS} />
      </div>
      {previewText(buf) ? (
        <p className="text-xs font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2">{previewText(buf)}</p>
      ) : null}
    </>
  );
}

export default function Ingredients() {
  const [purchases, setPurchases] = useState<IngredientPurchase[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuf, setEditBuf] = useState<any>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<any>({
    ingredient_name: '',
    supplier: '',
    date: new Date().toISOString().split('T')[0],
    qty: '',
    unit: 'pack',
    sizeEach: '',
    sizeUnit: 'g',
    totalPaid: '',
  });
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'ingredient_purchases'), orderBy('date', 'desc'));
    return onSnapshot(q, snap =>
      setPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })) as IngredientPurchase[])
    );
  }, []);

  const toggleStar = async (p: IngredientPurchase) => {
    try {
      await updateDoc(doc(db, 'ingredient_purchases', p.id), { starred: !p.starred });
      toast.success(p.starred ? 'Removed from recipe ingredients' : 'Added to recipe ingredients');
    } catch { toast.error('Failed to update'); }
  };

  const filtered = purchases.filter(p =>
    !search ||
    p.ingredient_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (p: IngredientPurchase) => {
    setEditingId(p.id);
    setEditBuf({
      ingredient_name: p.ingredient_name || '',
      supplier: p.supplier || '',
      date: p.date || '',
      qty: p.quantity ?? '',
      unit: p.unit || 'pcs',
      sizeEach: '',
      sizeUnit: 'g',
      totalPaid: (p.total_cost ?? ((Number(p.quantity) || 0) * (Number(p.unit_cost) || 0))) || '',
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const c = computePurchase(editBuf.qty, editBuf.unit, editBuf.sizeEach, editBuf.sizeUnit || 'g', editBuf.totalPaid);
      await updateDoc(doc(db, 'ingredient_purchases', editingId), {
        ingredient_name: editBuf.ingredient_name || '',
        supplier: editBuf.supplier || '',
        quantity: c.quantity,
        unit: c.unit,
        unit_cost: c.unit_cost,
        total_cost: c.total_cost,
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
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAddFormChange = (field: string, value: string | number) => {
    setAddForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleAddSubmit = async () => {
    if (!addForm.ingredient_name.trim()) {
      toast.error('Ingredient name is required');
      return;
    }
    if (!Number(addForm.qty) || !Number(addForm.totalPaid)) {
      toast.error('Enter how much you bought and the total you paid');
      return;
    }
    setAddSubmitting(true);
    try {
      const c = computePurchase(addForm.qty, addForm.unit, addForm.sizeEach, addForm.sizeUnit || 'g', addForm.totalPaid);
      await addDoc(collection(db, 'ingredient_purchases'), {
        ingredient_name: addForm.ingredient_name.trim(),
        supplier: addForm.supplier.trim(),
        quantity: c.quantity,
        unit: c.unit,
        unit_cost: c.unit_cost,
        total_cost: c.total_cost,
        date: addForm.date,
        logged_by: '',
        created_at: new Date().toISOString(),
        starred: false,
      });
      toast.success('Entry added');
      setShowAddModal(false);
      setAddForm({
        ingredient_name: '',
        supplier: '',
        date: new Date().toISOString().split('T')[0],
        qty: '',
        unit: 'pack',
        sizeEach: '',
        sizeUnit: 'g',
        totalPaid: '',
      });
    } catch { toast.error('Failed to add entry'); }
    setAddSubmitting(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ingredients</h1>
          <p className="text-sm text-gray-500 mt-1">
            Purchase history — auto-populated from Food &amp; Ingredients expenses
            <button
              onClick={() => setShowAddModal(true)}
              className="ml-3 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-terracotta text-white rounded-lg hover:bg-terracotta/90 transition-colors"
            >
              <Plus size={11} /> Add
            </button>
          </p>
          <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            Star a row to make it available in Recipe Costing
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search ingredient or supplier…"
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Scale size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No ingredients yet</p>
          <p className="text-gray-400 text-sm mt-1">Log a Food &amp; Ingredients expense with line items — they'll appear here automatically</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_1fr_100px_100px_100px_120px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <span>Ingredient</span>
            <span>Supplier</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit Cost</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <div className="divide-y divide-gray-50">
            {pageItems.map(p =>
              editingId === p.id ? (
                <div key={p.id} className="p-4 bg-amber-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL_CLS}>Ingredient</label>
                      <input value={editBuf.ingredient_name || ''} onChange={e => setEditBuf((b: any) => ({ ...b, ingredient_name: e.target.value }))} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LBL_CLS}>Supplier</label>
                      <input value={editBuf.supplier || ''} onChange={e => setEditBuf((b: any) => ({ ...b, supplier: e.target.value }))} className={INPUT_CLS} />
                    </div>
                  </div>
                  <PurchaseFields buf={editBuf} set={(f, v) => setEditBuf((b: any) => ({ ...b, [f]: v }))} />
                  <div>
                    <label className={LBL_CLS}>Date</label>
                    <input type="date" value={editBuf.date || ''} onChange={e => setEditBuf((b: any) => ({ ...b, date: e.target.value }))} className={INPUT_CLS} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 py-2 bg-terracotta text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1"><Check size={14} /> Save</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 flex items-center gap-1"><X size={14} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div key={p.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_100px_100px_100px_120px] gap-2 items-center px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{p.ingredient_name}</p>
                    <p className="text-xs text-gray-400">{p.date}</p>
                  </div>
                  <p className="text-sm text-gray-500 hidden md:block">{p.supplier || '—'}</p>
                  <p className="text-sm text-gray-700 text-right hidden md:block">{p.quantity} {p.unit}</p>
                  <p className="text-sm text-right hidden md:block">&#3647;{Number(p.unit_cost).toLocaleString()}<span className="text-xs text-gray-400">/{p.unit}</span></p>
                  <p className="text-sm font-semibold text-right">&#3647;{Number(p.total_cost).toLocaleString()}</p>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleStar(p)}
                      className={`p-1.5 rounded-lg transition-colors ${p.starred ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                      title={p.starred ? 'Remove from recipe ingredients' : 'Add to recipe ingredients'}
                    >
                      <Star size={14} className={p.starred ? 'fill-amber-400' : ''} />
                    </button>
                    {(p as any).receipt_url && (
                      <button onClick={() => setLightboxUrl((p as any).receipt_url)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-300 hover:text-green-500 transition-colors" title="View receipt"><Image size={13} /></button>
                    )}
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-400 transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              )
            )}
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">{filtered.length} purchase{filtered.length !== 1 ? 's' : ''}{search ? ' matching' : ''}</span>
          {totalPages > 1 && (
            <span className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage <= 1} className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-40">Prev</button>
              <span className="text-xs text-gray-500">Page {safePage} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage >= totalPages} className="px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 disabled:opacity-40">Next</button>
            </span>
          )}
            <span className="font-bold text-ink">&#3647;{totalSpent.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Receipt lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Receipt"
            className="max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Add line item modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-ink">Add Line Item</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Ingredient / Item <span className="text-red-400">*</span></label>
                <input
                  value={addForm.ingredient_name}
                  onChange={e => handleAddFormChange('ingredient_name', e.target.value)}
                  placeholder="e.g. Crawfish"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Supplier</label>
                <input
                  value={addForm.supplier}
                  onChange={e => handleAddFormChange('supplier', e.target.value)}
                  placeholder="e.g. Makro"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={e => handleAddFormChange('date', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                />
              </div>
              <PurchaseFields buf={addForm} set={handleAddFormChange} />
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleAddSubmit}
                disabled={addSubmitting}
                className="flex-1 py-2.5 bg-terracotta text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
              >
                <Plus size={14} /> {addSubmitting ? 'Saving…' : 'Add Entry'}
              </button>
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
