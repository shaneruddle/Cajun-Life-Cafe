import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, doc, setDoc, addDoc, query, where, orderBy, onSnapshot, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { logActivity } from '../../utils/logger';
import { DailyBalance, DailyBalanceFigure, DailyBalanceHistoryEntry } from './types';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';

type FigureField = 'cash' | 'kbank' | 'krungsri';

const FIELDS: { key: FigureField; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'kbank', label: 'KBank' },
  { key: 'krungsri', label: 'Krungsri' },
];

const DAYS_SHOWN = 30;

// A trading day stays editable through the following calendar day, then
// locks automatically — e.g. Jul 15's figures can be entered or corrected
// any time on Jul 15 or Jul 16, and become read-only starting Jul 17. No
// staged submit/verify workflow, no manual unlock — see the reconciliation
// planning discussion this was scoped down from.
const LOCK_GRACE_DAYS = 2;

// Local-calendar-day date string — NOT toISOString().slice(0,10), which
// rolls the date back a day for timezones ahead of UTC during early hours.
// Matches the convention already used in LogIncome.tsx.
const dateNDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const lockDateFor = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + LOCK_GRACE_DAYS);
  return d;
};

const isLocked = (dateStr: string) => new Date() >= lockDateFor(dateStr);

const shortName = (user: any) =>
  user?.nickname || user?.firstName || user?.displayName || user?.email?.split('@')[0] || 'Unknown';

const formatStamp = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
};

const fmtDateLabel = (dateStr: string, isToday: boolean) => {
  const d = new Date(`${dateStr}T00:00:00`);
  const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return isToday ? `${label} (Today)` : label;
};

export default function DailyBalances({ user }: { user: any }) {
  const [docs, setDocs] = useState<Record<string, DailyBalance>>({});
  const [editing, setEditing] = useState<{ date: string; field: FigureField } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyCache, setHistoryCache] = useState<Record<string, DailyBalanceHistoryEntry[] | 'loading'>>({});

  const dates = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => dateNDaysAgo(i)), []);
  const today = dates[0];

  useEffect(() => {
    const oldest = dates[dates.length - 1];
    const q = query(collection(db, 'daily_balances'), where('date', '>=', oldest), orderBy('date', 'desc'));
    return onSnapshot(q, snap => {
      const map: Record<string, DailyBalance> = {};
      snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as DailyBalance; });
      setDocs(map);
    });
  }, [dates]);

  const loadHistory = useCallback(async (date: string) => {
    if (historyCache[date]) return;
    setHistoryCache(prev => ({ ...prev, [date]: 'loading' }));
    try {
      const q = query(collection(db, 'daily_balances', date, 'history'), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })) as DailyBalanceHistoryEntry[];
      setHistoryCache(prev => ({ ...prev, [date]: entries }));
    } catch {
      setHistoryCache(prev => ({ ...prev, [date]: [] }));
    }
  }, [historyCache]);

  const startEdit = (date: string, field: FigureField, currentValue?: number) => {
    if (isLocked(date)) return;
    setEditing({ date, field });
    setEditValue(currentValue != null ? String(currentValue) : '');
  };

  const cancelEdit = () => { setEditing(null); setEditValue(''); };

  const saveEdit = async () => {
    if (!editing) return;
    const { date, field } = editing;
    const num = parseFloat(editValue);
    if (isNaN(num)) { toast.error('Enter a valid number'); cancelEdit(); return; }
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const entry: DailyBalanceFigure = {
        value: num,
        updatedBy: user?.email || 'unknown',
        updatedByName: shortName(user),
        updatedAt: nowIso,
      };
      const ref = doc(db, 'daily_balances', date);
      await setDoc(ref, {
        date,
        lockAt: Timestamp.fromDate(lockDateFor(date)),
        [field]: entry,
      }, { merge: true });
      await addDoc(collection(db, 'daily_balances', date, 'history'), { field, ...entry });
      await logActivity(
        'Daily Balance Updated',
        `${FIELDS.find(f => f.key === field)?.label} · ${date} · ฿${num.toLocaleString()}`,
        'finance'
      );
      setHistoryCache(prev => { const c = { ...prev }; delete c[date]; return c; });
      cancelEdit();
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => `฿${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-ink">Daily Balances</h1>
        <p className="text-sm text-gray-500 mt-1">
          Click any figure to enter or update it. Every change is timestamped and attributed to whoever made it.
          A day stays open through the following day, then locks automatically.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                {FIELDS.map(f => (
                  <th key={f.key} className="px-4 py-3 whitespace-nowrap text-right">{f.label}</th>
                ))}
                <th className="px-4 py-3 whitespace-nowrap text-right bg-gray-100">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dates.map(date => {
                const row = docs[date];
                const locked = isLocked(date);
                const isToday = date === today;
                const values = FIELDS.map(f => row?.[f.key]?.value);
                const filledCount = values.filter(v => v != null).length;
                const total = values.reduce((s: number, v) => s + (v || 0), 0);
                const missingLabels = FIELDS.filter((_, i) => values[i] == null).map(f => f.label);
                const dateHist = historyCache[date];

                return (
                  <tr key={date} className={`transition-colors ${isToday ? 'bg-terracotta/5' : 'hover:bg-cream/40'}`}>
                    <td className="px-4 py-3 font-medium text-ink whitespace-nowrap">
                      {fmtDateLabel(date, isToday)}
                      {locked && <Lock className="inline-block ml-1.5 text-gray-300" size={12} />}
                    </td>

                    {FIELDS.map(f => {
                      const figure = row?.[f.key];
                      const isEditingThis = editing?.date === date && editing.field === f.key;
                      const fieldHist = Array.isArray(dateHist) ? dateHist.filter(h => h.field === f.key) : undefined;
                      const hasHistory = !!fieldHist && fieldHist.length > 1;

                      return (
                        <td
                          key={f.key}
                          className="px-2 py-2 text-right relative group"
                          onMouseEnter={() => figure && loadHistory(date)}
                        >
                          {isEditingThis ? (
                            <input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              onBlur={saveEdit}
                              disabled={saving}
                              className="w-28 text-right border border-terracotta rounded-lg px-2 py-1.5 tabular-nums text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
                            />
                          ) : figure ? (
                            <>
                              <div
                                onClick={() => startEdit(date, f.key, figure.value)}
                                className={`w-28 ml-auto text-right border rounded-lg px-2 py-1.5 tabular-nums text-sm ${
                                  locked
                                    ? 'border-transparent text-gray-500 cursor-default'
                                    : 'border-transparent hover:border-gray-200 cursor-pointer'
                                } ${hasHistory ? 'bg-amber-50' : ''}`}
                              >
                                {fmt(figure.value)}
                              </div>
                              <div className="text-[10px] text-gray-400 mt-1 pr-1">
                                {figure.updatedByName} · {formatStamp(figure.updatedAt)}
                              </div>

                              {hasHistory && fieldHist && (
                                <div className="hidden group-hover:block absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-10 text-left">
                                  <p className="text-xs font-semibold text-ink mb-2">
                                    Edit history · {f.label}, {fmtDateLabel(date, isToday)}
                                  </p>
                                  <div className="space-y-2">
                                    {fieldHist.map((h, i) => (
                                      <div key={h.id} className={`flex justify-between text-xs ${i === 0 ? '' : 'text-gray-400'}`}>
                                        <span>{h.updatedByName} · {formatStamp(h.updatedAt)}</span>
                                        <span className={`tabular-nums ${i === 0 ? 'font-medium text-ink' : 'line-through'}`}>{fmt(h.value)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : locked ? (
                            <div className="w-28 ml-auto text-right text-sm text-gray-300">—</div>
                          ) : (
                            <button
                              onClick={() => startEdit(date, f.key)}
                              className="w-28 text-right border border-dashed border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:border-terracotta hover:text-terracotta transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-right tabular-nums font-semibold bg-gray-50">
                      <span className={filledCount === FIELDS.length ? 'text-ink' : 'text-gray-400'}>{fmt(total)}</span>
                      {filledCount > 0 && filledCount < FIELDS.length && (
                        <div className="text-[10px] font-normal text-red-500">missing {missingLabels.join(', ')}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 px-1">
        Total = whatever's been entered so far for that day — flagged if a figure is still missing.
        Hover a figure that's been corrected to see its full edit history.
      </p>
    </div>
  );
}
