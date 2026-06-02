import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Expense, Income } from './types';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const CATEGORY_COLORS = ['#C84B31', '#4A5240', '#E8DCC8', '#8B7355', '#6B8F71', '#D4A853'];

export default function FinanceOverview() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const startDate = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split('-').map(Number);
    const endDate = `${year}-${String(month + 1 > 12 ? 1 : month + 1).padStart(2, '0')}-01`;

    const expQ = query(collection(db, 'finance_expenses'), where('date', '>=', startDate), where('date', '<', endDate), orderBy('date', 'desc'));
    const unsubExp = onSnapshot(expQ, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]));

    const incQ = query(collection(db, 'finance_income'), where('date', '>=', startDate), where('date', '<', endDate), orderBy('date', 'desc'));
    const unsubInc = onSnapshot(incQ, snap => setIncome(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Income[]));

    return () => { unsubExp(); unsubInc(); };
  }, [selectedMonth]);

  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.total, 0), [expenses]);
  const totalIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income]);
  const net = totalIncome - totalExpenses;

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category_name] = (map[e.category_name] || 0) + e.total; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    income.forEach(i => { map[i.category] = (map[i.category] || 0) + i.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [income]);

  // Last 6 months for bar chart
  const monthlyTrend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months.map(m => ({
      month: m.slice(5), // MM
      income: income.filter(i => i.date.startsWith(m)).reduce((s, i) => s + i.amount, 0),
      expenses: expenses.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.total, 0),
    }));
  }, [income, expenses]);

  const fmt = (n: number) => `฿${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Generate month options (last 12 months)
  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      opts.push({ val, label });
    }
    return opts;
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Finance Overview</h1>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-terracotta">
          {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Income', value: totalIncome, icon: <TrendingUp size={20} />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Expenses', value: totalExpenses, icon: <TrendingDown size={20} />, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Net Profit', value: net, icon: net >= 0 ? <DollarSign size={20} /> : <AlertCircle size={20} />, color: net >= 0 ? 'text-olive' : 'text-red-600', bg: net >= 0 ? 'bg-cream' : 'bg-red-50' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div className={`${bg} ${color} p-2 rounded-full`}>{icon}</div>
            </div>
            <p className={`text-3xl font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {expensesByCategory.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-ink mb-4">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {expensesByCategory.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {incomeByCategory.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-ink mb-4">Income by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={incomeByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {incomeByCategory.map((_, i) => <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-ink mb-4">Recent Expenses</h3>
          {expenses.length === 0 ? <p className="text-gray-400 text-sm italic">No expenses this month</p> : (
            <div className="space-y-3">
              {expenses.slice(0, 6).map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-ink">{e.supplier || 'Unknown supplier'}</p>
                    <p className="text-xs text-gray-400">{e.category_name} · {e.date}</p>
                  </div>
                  <span className="font-bold text-red-500">{fmt(e.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-ink mb-4">Recent Income</h3>
          {income.length === 0 ? <p className="text-gray-400 text-sm italic">No income logged this month</p> : (
            <div className="space-y-3">
              {income.slice(0, 6).map(i => (
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
    </div>
  );
}
