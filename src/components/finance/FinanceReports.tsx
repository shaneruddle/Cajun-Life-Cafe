import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Expense, Income, Ingredient } from './types';
import { MenuItem } from '../../types';
import { Download, TrendingUp, TrendingDown } from 'lucide-react';

export default function FinanceReports() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const startDate = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonth = month + 1 > 12 ? 1 : month + 1;
    const nextYear = month + 1 > 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const expQ = query(collection(db, 'finance_expenses'), where('date', '>=', startDate), where('date', '<', endDate), orderBy('date'));
    const unsubExp = onSnapshot(expQ, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Expense[]));

    const incQ = query(collection(db, 'finance_income'), where('date', '>=', startDate), where('date', '<', endDate), orderBy('date'));
    const unsubInc = onSnapshot(incQ, snap => setIncome(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Income[]));

    getDocs(collection(db, 'finance_ingredients')).then(snap => setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ingredient[]));
    getDocs(collection(db, 'menu')).then(snap => setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[]));

    return () => { unsubExp(); unsubInc(); };
  }, [selectedMonth]);

  const totalIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.total, 0), [expenses]);
  const net = totalIncome - totalExpenses;
  const foodCostPct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category_name] = (map[e.category_name] || 0) + e.total; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    income.forEach(i => { map[i.category] = (map[i.category] || 0) + i.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [income]);

  // Cost per dish calculation
  const dishCosts = useMemo(() => {
    return menuItems.map(dish => {
      const linkedIngredients = ingredients.filter(ing => ing.menu_item_ids?.includes(dish.id));
      const totalCost = linkedIngredients.reduce((sum, ing) => {
        if (!ing.current_cost_per_unit || !ing.grams_per_serving) return sum;
        const costPerGram = ing.unit === 'kg' ? ing.current_cost_per_unit / 1000 : ing.current_cost_per_unit;
        return sum + (costPerGram * ing.grams_per_serving);
      }, 0);
      return { dish, linkedIngredients, totalCost };
    }).filter(d => d.linkedIngredients.length > 0).sort((a, b) => b.totalCost - a.totalCost);
  }, [menuItems, ingredients]);

  const fmt = (n: number) => `฿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  const exportCSV = () => {
    const rows = [
      ['Date', 'Type', 'Category', 'Description', 'Amount'],
      ...income.map(i => [i.date, 'Income', i.category, i.notes || '', i.amount]),
      ...expenses.map(e => [e.date, 'Expense', e.category_name, e.supplier || '', -e.total]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cajun-finance-${selectedMonth}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Monthly Report</h1>
        <div className="flex items-center gap-3">
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-terracotta">
            {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-ink mb-4">P&L Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Income', value: fmt(totalIncome), color: 'text-green-600' },
            { label: 'Total Expenses', value: fmt(totalExpenses), color: 'text-red-500' },
            { label: 'Net Profit', value: fmt(net), color: net >= 0 ? 'text-olive font-bold' : 'text-red-600 font-bold' },
            { label: 'Cost Ratio', value: `${foodCostPct.toFixed(1)}%`, color: foodCostPct < 60 ? 'text-green-600' : 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center p-4 bg-cream rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Income breakdown */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-ink mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-green-600" /> Income Breakdown</h2>
        {incomeByCategory.length === 0 ? <p className="text-gray-400 text-sm italic">No income this month</p> : (
          <div className="space-y-3">
            {incomeByCategory.map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-ink">{cat}</span>
                    <span className="font-bold text-green-600">{fmt(amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${totalIncome > 0 ? (amount / totalIncome) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">{totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expense breakdown */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-ink mb-4 flex items-center gap-2"><TrendingDown size={18} className="text-red-500" /> Expense Breakdown</h2>
        {expensesByCategory.length === 0 ? <p className="text-gray-400 text-sm italic">No expenses this month</p> : (
          <div className="space-y-3">
            {expensesByCategory.map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-ink">{cat}</span>
                    <span className="font-bold text-red-500">{fmt(amount)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0}%` }} />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">{totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost per dish */}
      {dishCosts.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-ink mb-1">Food Cost per Dish</h2>
          <p className="text-xs text-gray-400 mb-4">Based on current ingredient costs and grams per serving</p>
          <div className="space-y-3">
            {dishCosts.map(({ dish, linkedIngredients, totalCost }) => (
              <div key={dish.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-ink">{dish.name}</span>
                  <span className="font-bold text-terracotta">{fmt(totalCost)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkedIngredients.map(ing => {
                    const costPerGram = ing.unit === 'kg' && ing.current_cost_per_unit ? ing.current_cost_per_unit / 1000 : (ing.current_cost_per_unit || 0);
                    const cost = costPerGram * (ing.grams_per_serving || 0);
                    return (
                      <span key={ing.id} className="text-xs bg-cream px-2 py-1 rounded-full text-gray-600">
                        {ing.name} {ing.grams_per_serving}g {ing.current_cost_per_unit ? `(฿${cost.toFixed(2)})` : '(cost unknown)'}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All transactions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-bold text-ink mb-4">All Transactions</h2>
        {expenses.length === 0 && income.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No transactions this month</p>
        ) : (
          <div className="space-y-2">
            {[...income.map(i => ({ date: i.date, type: 'income' as const, label: i.category, sub: i.notes, amount: i.amount })),
              ...expenses.map(e => ({ date: e.date, type: 'expense' as const, label: e.supplier || e.category_name, sub: e.category_name, amount: e.total }))]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((t, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-ink">{t.label}</p>
                    <p className="text-xs text-gray-400">{t.date} · {t.sub}</p>
                  </div>
                  <span className={`font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
