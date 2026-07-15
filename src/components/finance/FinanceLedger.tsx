import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { logActivity } from '../../utils/logger';
import { Expense, Income } from './types';
import { Search, Pencil, Trash2, X, Loader2, ArrowUpDown, TrendingUp, TrendingDown, Scale } from 'lucide-react';
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

const INCOME_CATEGORIES = ['Food', 'Drinks', 'Meal Preps', 'Catering', 'Other'];

type LedgerEntry = {
  id: string;
  type: 'income' | 'expense';
  date: string;
  category: string;
  description: string;
  notes?: string;
  amount: number;
  logged_by: string;
  created_at: string;
  raw: Expense | Income;
};

type TypeFilter = 'all' | 'income' | 'expense';

const QUICK_RANGES = [
  { label: 'All time', days: null },
  { label: 'This month', days: 'month' as const },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

export default function FinanceLedger({ user, financeRole = 'owner' }: { user: any; financeRole?: string }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const [editEntry, setEditEntry] = useState<LedgerEntry | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubExpenses = onSnapshot(
      query(collection(db, 'finance_expenses'), orderBy('date', 'desc')),
      snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]),
      err => console.error('Ledger expenses error:', err)
    );
    const unsubIncome = onSnapshot(
      query(collection(db, 'finance_income'), orderBy('date', 'desc')),
      snap => {
        setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Income[]);
        setLoading(false);
      },
      err => { console.error('Ledger income error:', err); setLoading(false); }
    );
    return () => { unsubExpenses(); unsubIncome(); };
  }, []);

  const entries: LedgerEntry[] = useMemo(() => {
    const exp: LedgerEntry[] = expenses.map(e => ({
      id: e.id,
      type: 'expense',
      date: e.date,
      category: e.category_name || 'Other',
      description: e.supplier || '—',
      notes: e.notes,
      amount: e.total,
      logged_by: e.logged_by,
      created_at: e.created_at,
      raw: e,
    }));
    const inc: LedgerEntry[] = incomes.map(i => ({
      id: i.id,
      type: 'income',
      date: i.date,
      category: i.category || 'Other',
      description: i.notes || i.category,
      notes: i.notes,
      amount: i.amount,
      logged_by: i.logged_by,
      created_at: i.created_at,
      raw: i,
    }));
    return [...exp, ...inc];
  }, [expenses, incomes]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(entries.map(e => e.category).filter(Boolean)));
    return ['All', ...cats.sort()];
  }, [entries]);

  const applyQuickRange = (days: number | 'month' | null) => {
    if (days === null) {
      setFromDate('');
      setToDate('');
      return;
    }
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    let from: string;
    if (days === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    } else {
      const d = new Date();
      d.setDate(d.getDate() - days);
      from = d.toISOString().slice(0, 10);
    }
    setFromDate(from);
    setToDate(to);
  };

  const filtered = useMemo(() => {
    let list = entries;
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter);
    if (categoryFilter !== 'All') list = list.filter(e => e.category === categoryFilter);
    if (fromDate) list = list.filter(e => e.date >= fromDate);
    if (toDate) list = list.filter(e => e.date <= toDate);
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(e =>
        e.category.toLowerCase().includes(s) ||
        e.description.toLowerCase().includes(s) ||
        (e.notes || '').toLowerCase().includes(s) ||
        (e.logged_by || '').toLowerCase().includes(s)
      );
    }
    list = [...list].sort((a, b) => {
      const cmp = a.date === b.date ? a.created_at.localeCompare(b.created_at) : a.date.localeCompare(b.date);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [entries, typeFilter, categoryFilter, fromDate, toDate, search, sortAsc]);

  const totals = useMemo(() => {
    const income = filtered.filter(e => e.type === 'income').reduce((s, e) => s + (e.amount || 0), 0);
    const expense = filtered.filter(e => e.type === 'expense').reduce((s, e) => s + (e.amount || 0), 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const fmt = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const handleDelete = async (entry: LedgerEntry) => {
    if (!confirm(`Delete this ${entry.type} entry (${fmt(entry.amount)}, ${entry.date})? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, entry.type === 'expense' ? 'finance_expenses' : 'finance_income', entry.id));
      await logActivity(
        entry.type === 'expense' ? 'Expense Deleted' : 'Income Deleted',
        `${fmt(entry.amount)} · ${entry.category} · ${entry.date}`,
        'finance'
      );
      toast.success('Entry deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete entry');
    }
  };

  const handleSaveEdit = async (updated: { date: string; category: string; amount: number; description: string; notes: string }) => {
    if (!editEntry) return;
    setSaving(true);
    try {
      if (editEntry.type === 'expense') {
        const cat = EXPENSE_CATEGORIES.find(c => c.name === updated.category);
        await updateDoc(doc(db, 'finance_expenses', editEntry.id), {
          date: updated.date,
          supplier: updated.description,
          category_id: cat?.id || editEntry.raw && (editEntry.raw as Expense).category_id,
          category_name: updated.category,
          total: updated.amount,
          notes: updated.notes,
        });
        await logActivity('Expense Updated', `${fmt(updated.amount)} · ${updated.category} · ${updated.date}`, 'finance');
      } else {
        await updateDoc(doc(db, 'finance_income', editEntry.id), {
          date: updated.date,
          category: updated.category,
          amount: updated.amount,
          notes: updated.notes,
        });
        await logActivity('Income Updated', `${fmt(updated.amount)} · ${updated.category} · ${updated.date}`, 'finance');
      }
      toast.success('Entry updated');
      setEditEntry(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-6">Ledger</h1>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><TrendingUp size={20} /></div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Income (filtered)</p>
            <p className="text-xl font-bold text-green-600">{fmt(totals.income)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center"><TrendingDown size={20} /></div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Expenses (filtered)</p>
            <p className="text-xl font-bold text-red-500">{fmt(totals.expense)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center"><Scale size={20} /></div>
          <div>
            <p className="text-xs text-gray-400 font-medium">Net</p>
            <p className={`text-xl font-bold ${totals.net >= 0 ? 'text-ink' : 'text-red-500'}`}>{fmt(totals.net)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(['all', 'income', 'expense'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                typeFilter === t ? 'bg-terracotta text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {QUICK_RANGES.map(r => (
            <button
              key={r.label}
              onClick={() => applyQuickRange(r.days)}
              className="px-4 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-all"
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta">
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Supplier, notes, staff..." className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-terracotta" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-sm italic text-center py-16">No entries match these filters</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-widest text-gray-400">
                  <th className="px-5 py-3">
                    <button className="flex items-center gap-1 hover:text-ink" onClick={() => setSortAsc(!sortAsc)}>
                      Date <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Logged By</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={`${e.type}-${e.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{e.date}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        e.type === 'income' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink">{e.category}</td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">{e.description}{e.notes && e.description !== e.notes ? ` · ${e.notes}` : ''}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{e.logged_by}</td>
                    <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${e.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                      {e.type === 'income' ? '+' : '-'}{fmt(e.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditEntry(e)} className="p-1.5 rounded-lg text-gray-400 hover:text-terracotta hover:bg-terracotta/10 transition-colors" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-50">{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</div>
        )}
      </div>

      {editEntry && (
        <EditModal
          entry={editEntry}
          saving={saving}
          onClose={() => setEditEntry(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}

function EditModal({
  entry,
  saving,
  onClose,
  onSave,
}: {
  entry: LedgerEntry;
  saving: boolean;
  onClose: () => void;
  onSave: (updated: { date: string; category: string; amount: number; description: string; notes: string }) => void;
}) {
  const [date, setDate] = useState(entry.date);
  const [category, setCategory] = useState(entry.category);
  const [amount, setAmount] = useState(String(entry.amount));
  const [description, setDescription] = useState(entry.type === 'expense' ? entry.description : '');
  const [notes, setNotes] = useState(entry.notes || '');

  const categoryOptions = entry.type === 'expense' ? EXPENSE_CATEGORIES.map(c => c.name) : INCOME_CATEGORIES;

  const handleSubmit = () => {
    if (!date || !amount) {
      toast.error('Date and amount are required');
      return;
    }
    onSave({ date, category, amount: parseFloat(amount), description, notes });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-ink capitalize">Edit {entry.type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta">
              {!categoryOptions.includes(category) && <option value={category}>{category}</option>}
              {categoryOptions.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {entry.type === 'expense' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (฿)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
          </div>
        </div>

        {entry.type === 'expense' && (entry.raw as Expense).items?.length > 0 && (
          <p className="text-xs text-gray-400 italic mt-4">This expense has {(entry.raw as Expense).items.length} line item(s) which aren't editable here — only the top-line totals and details above.</p>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2.5 bg-terracotta text-white rounded-xl font-bold hover:bg-terracotta/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
