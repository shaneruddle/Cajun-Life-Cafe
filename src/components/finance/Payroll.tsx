import { useState, useEffect, useMemo, useRef } from 'react';
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
  RotateCcw,
  Receipt,
  Download,
  X,
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

// "2026-06" -> "June 2026" for the pay slip header
const formatMonthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
    shiftStart: '',
    shiftStartManual: false,
  }));

// --- OT calculation -----------------------------------------------------
// Staff aren't obliged to clock in before their shift starts, so an early
// amIn shouldn't count toward the 9-hour OT threshold. We estimate the
// "official" shift start per month from the most common amIn time (early
// outliers get outvoted by the typical day), and let a manager override
// any individual day — e.g. if the official start changed partway
// through the month — via the Shift Start column below.
const OT_THRESHOLD_HOURS = 9;

// Parses "HH:MM" (24h) into minutes since midnight; tolerant of odd OCR
// formatting (e.g. "8.30"). Returns null if unparseable/blank.
const parseTimeToMinutes = (raw?: string): number | null => {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
};

const minutesToTime = (mins: number): string =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

// Most common amIn time that month, rounded to the nearest 5 minutes.
const computeEstimatedStart = (entries: TimeCardDayEntry[]): string | null => {
  const buckets = new Map<number, number>();
  for (const e of entries) {
    const mins = parseTimeToMinutes(e.amIn);
    if (mins == null) continue;
    const bucket = Math.round(mins / 5) * 5;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [bucket, count] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
    if (count > bestCount) {
      bestCount = count;
      best = bucket;
    }
  }
  return best == null ? null : minutesToTime(best);
};

// Hours worked that day for OT purposes: amIn is clipped up to the
// effective shift start so early arrivals never count. Lunch (the gap
// between amOut and pmIn) is naturally excluded since only the two
// worked sessions are summed.
const computeDayHours = (e: TimeCardDayEntry, shiftStart: string | null) => {
  const shiftStartMins = parseTimeToMinutes(shiftStart || undefined);
  const amInMins = parseTimeToMinutes(e.amIn);
  const amOutMins = parseTimeToMinutes(e.amOut);
  const pmInMins = parseTimeToMinutes(e.pmIn);
  const pmOutMins = parseTimeToMinutes(e.pmOut);

  let amHours = 0;
  if (amInMins != null && amOutMins != null && amOutMins > amInMins) {
    const clippedIn = shiftStartMins != null ? Math.max(amInMins, shiftStartMins) : amInMins;
    amHours = Math.max(0, amOutMins - clippedIn) / 60;
  }
  let pmHours = 0;
  if (pmInMins != null && pmOutMins != null && pmOutMins > pmInMins) {
    pmHours = (pmOutMins - pmInMins) / 60;
  }
  const totalHours = amHours + pmHours;
  const otHours = Math.max(0, totalHours - OT_THRESHOLD_HOURS);
  return { totalHours, otHours };
};

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
  // Payroll details live on the user profile (users/{uid}), not on
  // finance_expenses like advances — fetched together and shown as a
  // reference block above the day table, never editable from here (edit
  // them from the Users dashboard instead).
  const [baseSalary, setBaseSalary] = useState<number | null>(null);
  const [ssoDeduction, setSsoDeduction] = useState<number | null>(null);
  const [otHourlyRate, setOtHourlyRate] = useState<number | null>(null);
  const [payrollNotes, setPayrollNotes] = useState('');
  const [position, setPosition] = useState('');

  const [showPayslip, setShowPayslip] = useState(false);

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
      setSsoDeduction(null);
      setOtHourlyRate(null);
      setPayrollNotes('');
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
        const userData = userSnap.exists() ? (userSnap.data() as any) : {};
        setBaseSalary(typeof userData.salary === 'number' ? userData.salary : null);
        setSsoDeduction(typeof userData.ssoDeduction === 'number' ? userData.ssoDeduction : null);
        setOtHourlyRate(typeof userData.otHourlyRate === 'number' ? userData.otHourlyRate : null);
        setPayrollNotes(userData.payrollNotes || '');
        setPosition(userData.position || '');
      } catch (err) {
        console.error('Failed to load payroll details:', err);
        setBaseSalary(null);
        setSsoDeduction(null);
        setOtHourlyRate(null);
        setPayrollNotes('');
        setPosition('');
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

  // Recomputes live as entries change (new scan, manual punch edit, or a
  // per-day Shift Start override) — days without a manual override track
  // the month's auto-estimated start automatically.
  const estimatedStart = useMemo(() => computeEstimatedStart(entries), [entries]);
  const dayComputations = useMemo(
    () =>
      entries.map(e => {
        const effectiveShiftStart = e.shiftStartManual && e.shiftStart ? e.shiftStart : estimatedStart;
        // "Time Over" — hours worked past the 9-hour OT threshold, purely
        // calculated from punches + effective shift start. Read-only.
        const { totalHours, otHours: timeOverHours } = computeDayHours(e, effectiveShiftStart);
        return { day: e.day, effectiveShiftStart, totalHours, timeOverHours };
      }),
    [entries, estimatedStart]
  );
  // "Paid OT" is a separate, purely manual figure — the actual overtime
  // hours a manager decides to pay for the day, independent of the
  // calculated Time Over. Blank by default; the manager types it in.
  const totalPaidOtHours = entries.reduce((sum, e) => sum + (e.otHours || 0), 0);
  const totalOtPay = otHourlyRate != null ? totalPaidOtHours * otHourlyRate : null;
  // Net pay for the pay slip: base salary + overtime pay, minus salary
  // advances and SSO deduction. Missing figures count as zero rather than
  // blocking the calculation, since not every employee has every field set.
  const netPay = (baseSalary || 0) + (totalOtPay || 0) - (advancesTotal || 0) - (ssoDeduction || 0);

  const updateEntry = (day: number, field: keyof TimeCardDayEntry, value: string) => {
    setEntries(prev => prev.map(e => (e.day === day ? { ...e, [field]: value } : e)));
  };

  // Shift Start is editable per day: typing a value marks that day as a
  // manual override (so it survives future re-scans/re-estimates); the
  // reset button clears the override and lets the day track the live
  // month-wide estimate again.
  const setShiftStartOverride = (day: number, value: string) => {
    setEntries(prev => prev.map(e => (e.day === day ? { ...e, shiftStart: value, shiftStartManual: true } : e)));
  };
  const clearShiftStartOverride = (day: number) => {
    setEntries(prev => prev.map(e => (e.day === day ? { ...e, shiftStart: '', shiftStartManual: false } : e)));
  };

  // Paid OT is a plain manual entry per day — blank until the manager
  // types the actual overtime hours to pay for that day.
  const setPaidOtHours = (day: number, value: string) => {
    const num = value === '' ? undefined : Number(value);
    setEntries(prev =>
      prev.map(e => (e.day === day ? { ...e, otHours: num === undefined || Number.isNaN(num) ? undefined : num } : e))
    );
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
              const prevEntry = byDay.get(sd.day);
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
                // Keep any manual Shift Start override / Paid OT entries across
                // a re-scan — only the punch/status/note fields come from the card.
                shiftStart: prevEntry?.shiftStart || '',
                shiftStartManual: prevEntry?.shiftStartManual || false,
                otHours: prevEntry?.otHours,
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
              <Banknote size={14} /> Staff Advances on file for {selectedLabel}
            </div>
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

          {/* Payroll details — read-only reference pulled from the staff
              profile (edit these from the Users dashboard). Shown once
              here at the top of the time card view rather than repeated
              in the advances panel below. */}
          {(baseSalary != null || ssoDeduction != null || otHourlyRate != null || payrollNotes || totalPaidOtHours > 0) && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
                <Banknote size={14} /> Payroll Details for {selectedLabel}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-cream rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Base Salary</div>
                  <div className="font-bold text-ink">{baseSalary != null ? `${fmtBaht(baseSalary)}/mo` : '—'}</div>
                </div>
                <div className="bg-cream rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">SSO Deduction</div>
                  <div className="font-bold text-ink">{ssoDeduction != null ? `${fmtBaht(ssoDeduction)}/mo` : '—'}</div>
                </div>
                <div className="bg-cream rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">OT Hourly Rate</div>
                  <div className="font-bold text-ink">{otHourlyRate != null ? `${fmtBaht(otHourlyRate)}/hr` : '—'}</div>
                </div>
                <div className="bg-cream rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Paid OT Hours</div>
                  <div className="font-bold text-ink">{totalPaidOtHours > 0 ? `${totalPaidOtHours.toFixed(2)}h` : '—'}</div>
                </div>
                <div className="bg-cream rounded-2xl p-4">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total OT Pay</div>
                  <div className="font-bold text-ink">{totalOtPay != null && totalOtPay > 0 ? fmtBaht(totalOtPay) : '—'}</div>
                </div>
              </div>
              {payrollNotes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payroll Notes</div>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{payrollNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Editable day table */}
          <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="p-6 pb-0 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                <Clock size={14} /> {month} — review &amp; correct before saving
              </div>
              {estimatedStart && (
                <span className="text-xs text-gray-400">
                  Estimated shift start: <strong className="text-gray-600">{estimatedStart}</strong> — override any day in the Shift Start column
                </span>
              )}
            </div>
            {loadingCard ? (
              <div className="p-10 flex justify-center text-gray-400"><Loader2 size={20} className="animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto p-6">
                <table className="text-sm border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="px-2 py-2 text-left">Day</th>
                      <th className="px-2 py-2 text-left">Shift Start</th>
                      <th className="px-2 py-2" colSpan={2}>Before Noon</th>
                      <th className="px-2 py-2" colSpan={2}>After Noon</th>
                      <th className="px-2 py-2 text-left">Total Hrs</th>
                      <th className="px-2 py-2 text-left">Time Over</th>
                      <th className="px-2 py-2 text-left">Paid OT</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Note</th>
                    </tr>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                      <th></th>
                      <th></th>
                      <th className="px-2 pb-2">In</th>
                      <th className="px-2 pb-2">Out</th>
                      <th className="px-2 pb-2">In</th>
                      <th className="px-2 pb-2">Out</th>
                      <th></th>
                      <th></th>
                      <th></th>
                      <th></th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((e, i) => {
                      const dc = dayComputations[i];
                      return (
                      <tr key={e.day} className={e.status ? 'bg-amber-50/40' : e.amIn ? 'bg-olive/5' : ''}>
                        <td className="px-2 py-1.5 font-bold text-gray-500">{e.day}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <input
                              value={dc?.effectiveShiftStart || ''}
                              onChange={ev => setShiftStartOverride(e.day, ev.target.value)}
                              placeholder="—"
                              title={e.shiftStartManual ? 'Manually overridden for this day' : 'Auto-estimated from this month\'s clock-ins'}
                              className={`${timeInputClass} ${e.shiftStartManual ? 'ring-1 ring-terracotta/50' : ''}`}
                            />
                            {e.shiftStartManual && (
                              <button
                                type="button"
                                onClick={() => clearShiftStartOverride(e.day)}
                                title="Reset to auto-estimated start time"
                                className="text-gray-300 hover:text-terracotta transition-colors"
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5"><input value={e.amIn || ''} onChange={ev => updateEntry(e.day, 'amIn', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.amOut || ''} onChange={ev => updateEntry(e.day, 'amOut', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.pmIn || ''} onChange={ev => updateEntry(e.day, 'pmIn', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5"><input value={e.pmOut || ''} onChange={ev => updateEntry(e.day, 'pmOut', ev.target.value)} placeholder="—" className={timeInputClass} /></td>
                        <td className="px-2 py-1.5 text-center font-bold text-ink">
                          {dc && dc.totalHours > 0 ? dc.totalHours.toFixed(2) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center font-bold text-ink">
                          {dc && dc.timeOverHours > 0 ? dc.timeOverHours.toFixed(2) : '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={e.otHours != null ? e.otHours : ''}
                            onChange={ev => setPaidOtHours(e.day, ev.target.value)}
                            placeholder="—"
                            title="Actual overtime hours to pay for this day"
                            className={`w-16 bg-gray-50 border-none rounded-lg px-2 py-1.5 text-sm text-center font-bold focus:ring-2 focus:ring-terracotta outline-none ${e.otHours ? 'text-terracotta' : 'text-gray-300'}`}
                          />
                        </td>
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
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100 text-sm">
                      <td colSpan={8} className="px-2 py-3 text-right text-gray-500 uppercase text-[11px] font-bold tracking-widest">
                        Total Paid OT
                      </td>
                      <td className="px-2 py-3 text-center font-bold text-terracotta">
                        {totalPaidOtHours > 0 ? `${totalPaidOtHours.toFixed(2)}h` : '—'}
                      </td>
                      <td colSpan={2} className="px-2 py-3 font-bold text-ink">
                        {otHourlyRate == null
                          ? 'Set an OT hourly rate on the Users tab to calculate pay'
                          : totalOtPay != null && totalOtPay > 0
                          ? `${fmtBaht(totalOtPay)} total OT pay`
                          : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Saving…' : 'Save Time Card'}
            </button>
            {(baseSalary != null || ssoDeduction != null || totalPaidOtHours > 0 || advancesTotal > 0) && (
              <button
                onClick={() => setShowPayslip(true)}
                className="flex items-center gap-2 px-8 py-4 bg-white border-2 border-olive text-olive rounded-2xl font-bold hover:bg-olive hover:text-white transition-all"
              >
                <Receipt size={18} /> Generate Pay Slip
              </button>
            )}
          </div>
        </>
      )}

      {showPayslip && (
        <PayslipModal
          onClose={() => setShowPayslip(false)}
          employeeName={selectedLabel || 'Employee'}
          position={position || cardPositionRaw}
          monthLabel={formatMonthLabel(month)}
          baseSalary={baseSalary}
          otPay={totalOtPay}
          advance={advancesTotal}
          sso={ssoDeduction}
          netPay={netPay}
        />
      )}
    </div>
  );
}

// Draws a rounded-rectangle path (manual implementation — avoids relying on
// the newer ctx.roundRect() browser API so this renders consistently).
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface PayslipModalProps {
  onClose: () => void;
  employeeName: string;
  position: string;
  monthLabel: string;
  baseSalary: number | null;
  otPay: number | null;
  advance: number;
  sso: number | null;
  netPay: number;
}

// Renders a branded pay slip straight to a <canvas> (no external image
// library) so it can be downloaded as a PNG with canvas.toBlob(). Drawn at
// 2x scale for a crisp image regardless of the user's screen density.
function PayslipModal({ onClose, employeeName, position, monthLabel, baseSalary, otPay, advance, sso, netPay }: PayslipModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const W = 900;
    const H = 560;
    const SCALE = 2;

    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = W * SCALE;
      canvas.height = H * SCALE;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(SCALE, SCALE);

      // Make sure brand fonts are loaded before measuring/drawing text —
      // otherwise the first paint can fall back to a system font.
      try {
        await Promise.all([
          document.fonts.load('700 26px "Libre Baskerville"'),
          document.fonts.load('600 14px "Inter"'),
          document.fonts.load('400 12px "Inter"'),
        ]);
      } catch {
        // Font Loading API not available — fall back to default fonts, fine.
      }

      const logo = new Image();
      logo.src = '/logo.png';
      const logoLoaded = await new Promise<boolean>(resolve => {
        logo.onload = () => resolve(true);
        logo.onerror = () => resolve(false);
      });
      if (cancelled) return;

      const ink = '#1A1A1A';
      const terracotta = '#A64B2A';
      const olive = '#5A5A40';
      const cream = '#F5F5F0';
      const gray = '#8A8A85';

      // Card background + border
      ctx.fillStyle = '#FFFFFF';
      roundRectPath(ctx, 0, 0, W, H, 20);
      ctx.fill();
      ctx.strokeStyle = '#E5E5E0';
      ctx.lineWidth = 1;
      roundRectPath(ctx, 0.5, 0.5, W - 1, H - 1, 20);
      ctx.stroke();

      // Header band
      ctx.fillStyle = cream;
      roundRectPath(ctx, 0, 0, W, 130, 20);
      ctx.fill();
      ctx.fillRect(0, 110, W, 20); // square off the bottom corners of the band
      ctx.strokeStyle = olive;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 130);
      ctx.lineTo(W, 130);
      ctx.stroke();

      const padX = 40;
      let logoW = 0;
      if (logoLoaded) {
        const logoH = 72;
        logoW = (logo.width / logo.height) * logoH;
        ctx.drawImage(logo, padX, 29, logoW, logoH);
      }

      const brandX = padX + (logoW > 0 ? logoW + 16 : 0);
      ctx.fillStyle = ink;
      ctx.font = '700 26px "Libre Baskerville", serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('CAJUN LIFE CAFE', brandX, 60);
      ctx.fillStyle = gray;
      ctx.font = '400 12px "Inter", sans-serif';
      ctx.fillText('Healthy Eating · Pratumnak Hill, Pattaya', brandX, 80);

      ctx.textAlign = 'right';
      ctx.fillStyle = terracotta;
      ctx.font = '700 24px "Libre Baskerville", serif';
      ctx.fillText('PAY SLIP', W - padX, 55);
      ctx.fillStyle = ink;
      ctx.font = '600 13px "Inter", sans-serif';
      ctx.fillText(`Pay Period: ${monthLabel}`, W - padX, 78);
      ctx.textAlign = 'left';

      // Employee info block
      let y = 168;
      const labelColor = gray;
      const valueColor = ink;

      ctx.font = '700 10px "Inter", sans-serif';
      ctx.fillStyle = labelColor;
      ctx.fillText('EMPLOYEE NAME', padX, y);
      ctx.font = '700 16px "Inter", sans-serif';
      ctx.fillStyle = valueColor;
      ctx.fillText(employeeName, padX, y + 22);

      if (position) {
        ctx.font = '700 10px "Inter", sans-serif';
        ctx.fillStyle = labelColor;
        ctx.fillText('POSITION', W / 2 + 20, y);
        ctx.font = '700 16px "Inter", sans-serif';
        ctx.fillStyle = valueColor;
        ctx.fillText(position, W / 2 + 20, y + 22);
      }

      // Income / Deductions table
      const tableTop = 235;
      const colGap = 20;
      const colW = (W - padX * 2 - colGap) / 2;
      const leftX = padX;
      const rightX = padX + colW + colGap;

      ctx.fillStyle = olive + '1A'; // ~10% opacity via hex alpha
      roundRectPath(ctx, leftX, tableTop, colW, 30, 8);
      ctx.fill();
      roundRectPath(ctx, rightX, tableTop, colW, 30, 8);
      ctx.fill();

      ctx.font = '700 11px "Inter", sans-serif';
      ctx.fillStyle = olive;
      ctx.fillText('INCOME', leftX + 16, tableTop + 20);
      ctx.fillText('DEDUCTIONS', rightX + 16, tableTop + 20);

      const rowLabelFont = '400 14px "Inter", sans-serif';
      const rowValueFont = '700 14px "Inter", sans-serif';
      const rowH = 34;
      let rowY = tableTop + 30 + 30;

      const drawRow = (x: number, colWidth: number, label: string, value: string, bold = false) => {
        ctx.font = bold ? rowValueFont : rowLabelFont;
        ctx.fillStyle = bold ? ink : '#4A4A45';
        ctx.fillText(label, x + 16, rowY);
        ctx.font = rowValueFont;
        ctx.fillStyle = ink;
        ctx.textAlign = 'right';
        ctx.fillText(value, x + colWidth - 16, rowY);
        ctx.textAlign = 'left';
      };

      const incomeTotal = (baseSalary || 0) + (otPay || 0);
      const deductionsTotal = (advance || 0) + (sso || 0);

      drawRow(leftX, colW, 'Base Salary', baseSalary != null ? fmtBaht(baseSalary) : '—');
      drawRow(rightX, colW, 'Salary Advance', advance > 0 ? fmtBaht(advance) : '—');
      rowY += rowH;
      drawRow(leftX, colW, 'Overtime Pay', otPay != null && otPay > 0 ? fmtBaht(otPay) : '—');
      drawRow(rightX, colW, 'Social Security (SSO)', sso != null ? fmtBaht(sso) : '—');
      rowY += rowH + 6;

      ctx.strokeStyle = '#E5E5E0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(leftX, rowY - rowH / 2 - 2);
      ctx.lineTo(leftX + colW, rowY - rowH / 2 - 2);
      ctx.moveTo(rightX, rowY - rowH / 2 - 2);
      ctx.lineTo(rightX + colW, rowY - rowH / 2 - 2);
      ctx.stroke();

      drawRow(leftX, colW, 'Total Income', fmtBaht(incomeTotal), true);
      drawRow(rightX, colW, 'Total Deductions', fmtBaht(deductionsTotal), true);

      // Net pay banner
      const bannerY = rowY + 40;
      const bannerH = 64;
      ctx.fillStyle = terracotta;
      roundRectPath(ctx, padX, bannerY, W - padX * 2, bannerH, 14);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 14px "Inter", sans-serif';
      ctx.fillText('NET PAY', padX + 24, bannerY + 26);
      ctx.font = '700 28px "Libre Baskerville", serif';
      ctx.textAlign = 'right';
      ctx.fillText(fmtBaht(netPay), W - padX - 24, bannerY + 42);
      ctx.textAlign = 'left';

      // Footer
      ctx.strokeStyle = '#E5E5E0';
      ctx.beginPath();
      ctx.moveTo(padX, H - 44);
      ctx.lineTo(W - padX, H - 44);
      ctx.stroke();
      ctx.font = '400 11px "Inter", sans-serif';
      ctx.fillStyle = gray;
      ctx.textAlign = 'center';
      const generatedOn = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      ctx.fillText(`Generated on ${generatedOn} · Cajun Life Cafe Payroll`, W / 2, H - 24);
      ctx.textAlign = 'left';

      if (!cancelled) setReady(true);
    };

    draw();
    return () => {
      cancelled = true;
    };
  }, [employeeName, position, monthLabel, baseSalary, otPay, advance, sso, netPay]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = employeeName.replace(/\s+/g, '_');
      a.href = url;
      a.download = `PaySlip_${safeName}_${monthLabel.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl p-6 max-w-full max-h-full overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-ink flex items-center gap-2">
            <Receipt size={18} className="text-terracotta" /> Pay Slip Preview
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-ink transition-colors" title="Close">
            <X size={22} />
          </button>
        </div>

        <div className="overflow-auto rounded-2xl border border-gray-100">
          <canvas ref={canvasRef} />
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={handleDownload}
            disabled={!ready}
            className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all disabled:opacity-60"
          >
            <Download size={16} /> Download as Image
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
