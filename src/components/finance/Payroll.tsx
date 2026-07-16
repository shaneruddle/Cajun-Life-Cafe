import { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { logActivity } from '../../utils/logger';
import { useStaffOptions, staffLabel } from '../../utils/staffDirectory';
import { TimeCard, TimeCardDayEntry } from '../../types';
import { Expense } from './types';
import {
  Upload,
  Loader2,
  Save,
  Clock,
  Banknote,
  AlertTriangle,
  Check,
  ImagePlus,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

const todayMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return 31;
  return new Date(y, m, 0).getDate();
};

const emptyEntries = (month: string): TimeCardDayEntry[] =>
  Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: i + 1,
    amIn: '',
    amOut: '',
    pmIn: '',
    pmOut: '',
    otIn: '',
    otOut: '',
    status: '' as TimeCardDayEntry['status'],
    note: '',
  }));

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const fmtBaht = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Payroll({ user }: { user: any; financeRole?: string }) {
  const staffOptions = useStaffOptions();
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(todayMonth());

  const [entries, setEntries] = useState<TimeCardDayEntry[]>(emptyEntries(todayMonth()));
  const [cardNameRaw, setCardNameRaw] = useState('');
  const [cardPositionRaw, setCardPositionRaw] = useState('');
  const [existingCardImageUrls, setExistingCardImageUrls] = useState<string[]>([]);
  const [loadingCard, setLoadingCard] = useState(false);

  const [advances, setAdvances] = useState<Expense[]>([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  // Base salary lives on the user profile (users/{uid}.salary), not on
  // finance_expenses like advances — fetched separately and shown as a
  // reference line above the advances list, never editable from here.
  const [baseSalary, setBaseSalary] = useState<number | null>(null);

  const [existingMonths, setExistingMonths] = useState<string[]>([]);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedStaff = staffOptions.find(s => s.uid === employeeId);
  const selectedLabel = selectedStaff ? staffLabel(selectedStaff) : '';

  // Load the existing time card (if any) + salary advances + a list of
  // other months already on file, whenever the employee or month changes.
  useEffect(() => {
    if (!employeeId) {
      setEntries(emptyEntries(month));
      setCardNameRaw('');
      setCardPositionRaw('');
      setExistingCardImageUrls([]);
      setAdvances([]);
      setExistingMonths([]);
      setBaseSalary(null);
      return;
    }

    (async () => {
      setLoadingCard(true);
      try {
        const snap = await getDoc(doc(db, 'payroll_timecards', `${employeeId}_${month}`));
        if (snap.exists()) {
          const data = snap.data() as TimeCard;
          setEntries(data.entries?.length ? data.entries : emptyEntries(month));
          setCardNameRaw(data.cardNameRaw || '');
          setCardPositionRaw(data.cardPositionRaw || '');
          setExistingCardImageUrls(data.cardImageUrls || []);
        } else {
          setEntries(emptyEntries(month));
          setCardNameRaw('');
          setCardPositionRaw('');
          setExistingCardImageUrls([]);
        }
      } catch (err) {
        console.error('Failed to load time card:', err);
        toast.error('Could not load existing time card');
      } finally {
        setLoadingCard(false);
      }
    })();

    (async () => {
      setLoadingAdvances(true);
      try {
        const q = query(
          collection(db, 'finance_expenses'),
          where('employeeId', '==', employeeId),
          where('category_id', '==', 'salary_staff_advances')
        );
        const snap = await getDocs(q);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Expense)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setAdvances(list);
      } catch (err) {
        console.error('Failed to load salary advances:', err);
      } finally {
        setLoadingAdvances(false);
      }
    })();

    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', employeeId));
        const salaryValue = userSnap.exists() ? (userSnap.data() as any).salary : undefined;
        setBaseSalary(typeof salaryValue === 'number' ? salaryValue : null);
      } catch (err) {
        console.error('Failed to load base salary:', err);
        setBaseSalary(null);
      }
    })();

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'payroll_timecards'), where('employeeId', '==', employeeId))
        );
        setExistingMonths(
          snap.docs
            .map(d => (d.data() as TimeCard).month)
            .filter(Boolean)
            .sort((a, b) => b.localeCompare(a))
        );
      } catch (err) {
        console.error('Failed to load time card history:', err);
      }
    })();
  }, [employeeId, month]);

  const advancesTotal = advances.reduce((sum, a) => sum + (a.total || 0), 0);

  const updateEntry = (day: number, field: keyof TimeCardDayEntry, value: string) => {
    setEntries(prev => prev.map(e => (e.day === day ? { ...e, [field]: value } : e)));
  };

  const handleScan = async () => {
    if (!frontFile && !backFile) {
      toast.error('Choose at least one card photo (front or back)');
      return;
    }
    setScanning(true);
    try {
      const images = [];
      if (frontFile) images.push({ imageBase64: await fileToBase64(frontFile), mimeType: frontFile.type });
      if (backFile) images.push({ imageBase64: await fileToBase64(backFile), mimeType: backFile.type });

      const response = await fetch('https://cajun-life-cafe-server-1006330230181.asia-east1.run.app/api/ocr-timecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, expectedEmployeeName: selectedLabel }),
      });
      const result = await response.json();

      if (result.success && result.data) {
        const d = result.data;
        setCardNameRaw(d.cardNameRaw || '');
        setCardPositionRaw(d.cardPositionRaw || '');
        const scannedDays: TimeCardDayEntry[] = Array.isArray(d.days) ? d.days : [];
        if (scannedDays.length) {
          setEntries(prev => {
            const byDay = new Map(prev.map(e => [e.day, e]));
            for (const sd of scannedDays) {
              if (!sd?.day) continue;
              byDay.set(sd.day, {
                day: sd.day,
                amIn: sd.amIn || '',
                amOut: sd.amOut || '',
                pmIn: sd.pmIn || '',
                pmOut: sd.pmOut || '',
                otIn: sd.otIn || '',
                otOut: sd.otOut || '',
                status: (sd.status || '') as TimeCardDayEntry['status'],
                note: sd.note || '',
              });
            }
            return Array.from(byDay.values()).sort((a, b) => a.day - b.day);
          });
          toast.success(`Scanned ${scannedDays.length} day${scannedDays.length !== 1 ? 's' : ''} — review before saving`);
        } else {
          toast.error('Could not read any days off the card — please fill in manually');
        }
      } else {
        toast.error('Scan failed — please fill in manually');
      }
    } catch (err) {
      console.error('Timecard scan error:', err);
      toast.error('Scan failed — please fill in manually');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!employeeId) {
      toast.error('Select a staff member first');
      return;
    }
    setSaving(true);
    try {
      const cardImageUrls = [...existingCardImageUrls];
      if (frontFile) {
        const r = ref(storage, `timecards/${employeeId}/${month}_front_${Date.now()}_${frontFile.name}`);
        await uploadBytes(r, frontFile);
        cardImageUrls.push(await getDownloadURL(r));
      }
      if (backFile) {
        const r = ref(storage, `timecards/${employeeId}/${month}_back_${Date.now()}_${backFile.name}`);
        await uploadBytes(r, backFile);
        cardImageUrls.push(await getDownloadURL(r));
      }

      const docId = `${employeeId}_${month}`;
      const existingSnap = await getDoc(doc(db, 'payroll_timecards', docId));
      const now = new Date().toISOString();

      const payload: TimeCard = {
        employeeId,
        employeeName: selectedLabel || employeeId,
        month,
        cardNameRaw,
        cardPositionRaw,
        entries,
        cardImageUrls,
        uploadedBy: user?.email || 'unknown',
        createdAt: existingSnap.exists() ? (existingSnap.data() as TimeCard).createdAt || now : now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'payroll_timecards', docId), payload);
      await logActivity('Time Card Saved', `${selectedLabel || employeeId} · ${month} · ${entries.filter(e => e.amIn || e.status).length} days recorded`, 'finance');

      toast.success('Time card saved');
      setFrontFile(null);
      setBackFile(null);
      setExistingCardImageUrls(cardImageUrls);
    } catch (err) {
      console.error('Failed to save time card:', err);
      toast.error('Failed to save time card');
    } finally {
      setSaving(false);
    }
  };

  const nameMismatch =
    cardNameRaw && selectedLabel && !selectedLabel.toLowerCase().includes(cardNameRaw.toLowerCase().split(' ')[0] || '###');

  const timeInputClass = 'w-20 bg-gray-50 border-none rounded-lg px-2 py-1.5 text-sm text-center focus:ring-2 focus:ring-terracotta outline-none';

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 bg-terracotta/10 rounded-2xl flex items-center justify-center text-terracotta">
          <Clock size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-ink">Payroll — Time Cards</h1>
          <p className="text-gray-500 text-sm">Upload a photo of a clock-in card, review the scanned hours, then save.</p>
        </div>
      </div>

      {/* Step 1: employee + month */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Staff Member</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
            >
              <option value="">Select staff member…</option>
              {staffOptions.map(s => <option key={s.uid} value={s.uid}>{staffLabel(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Month</label>
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
            />
          </div>
        </div>
        {existingMonths.length > 0 && (
          <p className="text-xs text-gray-400 mt-4">
            Time cards already on file for {selectedLabel}: {existingMonths.join(', ')}
          </p>
        )}
      </div>

      {employeeId && (
        <>
          {/* Salary advances panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              <Banknote size={14} /> Salary &amp; Staff Advances on file for {selectedLabel}
            </div>
            {baseSalary != null && (
              <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3 mb-3">
                <span className="text-gray-500">Base salary (from staff profile)</span>
                <span className="font-bold text-ink">{fmtBaht(baseSalary)}/month</span>
              </div>
            )}
            {loadingAdvances ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : advances.length === 0 ? (
              <p className="text-sm text-gray-400">No advance payments logged for this staff member yet.</p>
            ) : (
              <div className="space-y-2">
                {advances.map(a => (
                  <div key={a.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2">
                    <span className="text-gray-500">{a.date}{a.notes ? ` · ${a.notes}` : ''}</span>
                    <span className="font-bold text-ink">{fmtBaht(a.total)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 font-bold text-terracotta">
                  <span>Total</span>
                  <span>{fmtBaht(advancesTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Upload + scan */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              <ImagePlus size={14} /> Card Photos
            </div>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <label className="flex flex-col items-center justify-center gap-2 p-6 bg-cream rounded-2xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-terracotta transition-all text-center">
                <FileText size={24} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">{frontFile ? frontFile.name : 'Front of card (days 1–15)'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setFrontFile(e.target.files?.[0] || null)} />
              </label>
              <label className="flex flex-col items-center justify-center gap-2 p-6 bg-cream rounded-2xl border-2 border-dashed border-gray-200 cursor-pointer hover:border-terracotta transition-all text-center">
                <FileText size={24} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">{backFile ? backFile.name : 'Back of card (days 16–31)'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setBackFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning || (!frontFile && !backFile)}
              className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all font-bold disabled:opacity-50"
            >
              {scanning ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {scanning ? 'Scanning…' : 'Scan Card(s)'}
            </button>

            {cardNameRaw && (
              <div className={`mt-4 p-3 rounded-xl text-sm flex items-start gap-2 ${nameMismatch ? 'bg-amber-50 text-amber-800' : 'bg-olive/10 text-olive'}`}>
                {nameMismatch ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <Check size={16} className="shrink-0 mt-0.5" />}
                <span>Card reads: <strong>{cardNameRaw}</strong>{cardPositionRaw ? ` (${cardPositionRaw})` : ''} — {nameMismatch ? 'this may not match the staff member selected above, double-check.' : 'looks like it matches the selected staff member.'}</span>
              </div>
            )}
            {existingCardImageUrls.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">{existingCardImageUrls.length} photo{existingCardImageUrls.length !== 1 ? 's' : ''} already saved for this month.</p>
            )}
          </div>

          {/* Editable day table */}
          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-6 pb-0 flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <Clock size={14} /> {month} — review &amp; correct before saving
            </div>
            {loadingCard ? (
              <div className="p-10 flex justify-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto p-6">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-2 py-2 text-left">Day</th>
                      <th className="px-2 py-2" colSpan={2}>Before Noon</th>
                      <th className="px-2 py-2" colSpan={2}>After Noon</th>
                      <th className="px-2 py-2" colSpan={2}>Overtime</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Note</th>
                    </tr>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                      <th></th>
                      <th className="px-2 pb-2">In</th>
                      <th className="px-2 pb-2">Out</th>
                      <th className="px-2 pb-2">In</th>
                      <th className="px-2 pb-2">Out</th>
                      <th className="px-2 pb-2">In</th>
                      <th className="px-2 pb-2">Out</th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map(e => (
                      <tr key={e.day} className={e.status ? 'bg-amber-50/40' : e.amIn ? 'bg-olive/5' : ''}>
                        <td className="px-2 py-1.5 font-bold text-gray-500">{e.day}</td>
                        <td className="px-2 py-1.5"><input value={e.amIn || ''} onChange={ev => updateEntry(e.day, 'amIn', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.amOut || ''} onChange={ev => updateEntry(e.day, 'amOut', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.pmIn || ''} onChange={ev => updateEntry(e.day, 'pmIn', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.pmOut || ''} onChange={ev => updateEntry(e.day, 'pmOut', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.otIn || ''} onChange={ev => updateEntry(e.day, 'otIn', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.otOut || ''} onChange={ev => updateEntry(e.day, 'otOut', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5">
                          <select
                            value={e.status || ''}
                            onChange={ev => updateEntry(e.day, 'status', ev.target.value)}
                            className="bg-gray-50 border-none rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-terracotta outline-none"
                          >
                            <option value="">—</option>
                            <option value="CD">CD</option>
                            <option value="OFF">OFF</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={e.note || ''}
                            onChange={ev => updateEntry(e.day, 'note', ev.target.value)}
                            placeholder="handwritten notes…"
                            className="w-40 bg-gray-50 border-none rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-terracotta outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Saving…' : 'Save Time Card'}
          </button>
        </>
      )}
    </div>
  );
}
