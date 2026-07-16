import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CalendarEvent } from '../types';
import { logActivity } from '../utils/logger';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Edit2,
  Trash2,
  Loader2,
  Clock,
  StickyNote,
  Repeat,
} from 'lucide-react';
import { toast } from 'sonner';

const EVENT_TYPES: { id: CalendarEvent['type']; label: string; dot: string; badge: string }[] = [
  { id: 'national_holiday', label: 'National Holiday', dot: 'bg-terracotta', badge: 'bg-terracotta/10 text-terracotta' },
  { id: 'holiday', label: 'Cafe Holiday / Closure', dot: 'bg-olive', badge: 'bg-olive/10 text-olive' },
  { id: 'license_renewal', label: 'License Renewal', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  { id: 'other', label: 'Other', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' },
];

const typeMeta = (type: CalendarEvent['type']) => EVENT_TYPES.find(t => t.id === type) || EVENT_TYPES[3];

const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDateStr = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Does `event` occur on `cellDate`? For a recurring event, only the
// month/day of `date`/`endDate` are reused each year — the stored year is
// irrelevant once recurringAnnually is set.
const eventOccursOnDate = (event: CalendarEvent, cellDate: Date): boolean => {
  const start = parseDateStr(event.date);
  const end = parseDateStr(event.endDate || event.date);
  if (event.recurringAnnually) {
    const occStart = new Date(cellDate.getFullYear(), start.getMonth(), start.getDate());
    const occEnd = new Date(cellDate.getFullYear(), end.getMonth(), end.getDate());
    return cellDate >= occStart && cellDate <= occEnd;
  }
  return cellDate >= start && cellDate <= end;
};

// Next occurrence of `event` on/after `fromDate` (recurring events roll
// forward to next year if this year's occurrence has already passed).
const nextOccurrence = (event: CalendarEvent, fromDate: Date): Date => {
  const start = parseDateStr(event.date);
  if (!event.recurringAnnually) return start;
  let occ = new Date(fromDate.getFullYear(), start.getMonth(), start.getDate());
  const endOfDayFrom = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  if (occ < endOfDayFrom) occ = new Date(fromDate.getFullYear() + 1, start.getMonth(), start.getDate());
  return occ;
};

const emptyForm: Partial<CalendarEvent> = {
  title: '',
  date: toDateStr(new Date()),
  endDate: '',
  type: 'holiday',
  recurringAnnually: false,
  notes: '',
};

const MONTH_LABEL = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarDashboard({ user }: { user: any }) {
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [formData, setFormData] = useState<Partial<CalendarEvent>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [viewingEvents, setViewingEvents] = useState<{ date: Date; list: CalendarEvent[] } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'calendar_events'), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      snap => {
        setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CalendarEvent[]);
        setLoading(false);
      },
      err => {
        console.error('Calendar events snapshot error:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // 6x7 grid of dates covering the visible month, including leading/
  // trailing days from the adjacent months so every week row is full.
  const gridDates = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [viewYear, viewMonth]);

  const eventsForDate = (d: Date) => events.filter(e => eventOccursOnDate(e, d));

  const upcoming = useMemo(() => {
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return events
      .map(e => ({ event: e, occursOn: nextOccurrence(e, from) }))
      .filter(x => x.occursOn >= from)
      .sort((a, b) => a.occursOn.getTime() - b.occursOn.getTime())
      .slice(0, 8);
  }, [events, today]);

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1);
  };
  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); };

  const openAddForm = (prefillDate?: Date) => {
    setEditingEvent(null);
    setFormData({ ...emptyForm, date: toDateStr(prefillDate || today) });
    setFormOpen(true);
  };
  const openEditForm = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormData({ ...event });
    setFormOpen(true);
    setViewingEvents(null);
  };
  const closeForm = () => { setFormOpen(false); setEditingEvent(null); setFormData(emptyForm); };

  const handleSave = async () => {
    if (!formData.title?.trim()) { toast.error('Give the event a title'); return; }
    if (!formData.date) { toast.error('Pick a date'); return; }
    if (formData.endDate && formData.endDate < formData.date) { toast.error('End date is before the start date'); return; }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload: Omit<CalendarEvent, 'id'> = {
        title: formData.title.trim(),
        date: formData.date,
        endDate: formData.endDate || undefined,
        type: (formData.type as CalendarEvent['type']) || 'other',
        recurringAnnually: !!formData.recurringAnnually,
        notes: formData.notes?.trim() || undefined,
        createdBy: editingEvent?.createdBy || auth.currentUser?.email || 'unknown',
        createdAt: editingEvent?.createdAt || now,
        updatedAt: now,
      };

      if (editingEvent?.id) {
        await updateDoc(doc(db, 'calendar_events', editingEvent.id), payload as any);
        await logActivity('Calendar Event Updated', `${payload.title} · ${payload.date}`, 'calendar');
        toast.success('Event updated');
      } else {
        await addDoc(collection(db, 'calendar_events'), payload);
        await logActivity('Calendar Event Added', `${payload.title} · ${payload.date}`, 'calendar');
        toast.success('Event added');
      }
      closeForm();
    } catch (err) {
      console.error('Failed to save calendar event:', err);
      toast.error('Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: CalendarEvent) => {
    if (!event.id) return;
    if (!window.confirm(`Delete "${event.title}"? This can't be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'calendar_events', event.id));
      await logActivity('Calendar Event Deleted', `${event.title} · ${event.date}`, 'calendar');
      toast.success('Event deleted');
      setViewingEvents(null);
    } catch (err) {
      console.error('Failed to delete calendar event:', err);
      toast.error('Failed to delete event');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-terracotta/10 rounded-2xl flex items-center justify-center text-terracotta">
            <CalendarDays size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-ink">Calendar</h1>
            <p className="text-gray-500 text-sm">Holidays, national holidays, licence renewals, and other dates worth flagging.</p>
          </div>
        </div>
        {isManager && (
          <button
            onClick={() => openAddForm()}
            className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all"
          >
            <Plus size={18} /> Add Event
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {EVENT_TYPES.map(t => (
          <div key={t.id} className="flex items-center gap-2 text-xs font-medium text-gray-500">
            <span className={`w-2.5 h-2.5 rounded-full ${t.dot}`} />
            {t.label}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        {/* Month grid */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4">
            <h2 className="text-lg font-display font-bold text-ink">{MONTH_LABEL(viewYear, viewMonth)}</h2>
            <div className="flex items-center gap-2">
              <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">Today</button>
              <button onClick={goPrevMonth} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-ink transition-colors"><ChevronLeft size={18} /></button>
              <button onClick={goNextMonth} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-ink transition-colors"><ChevronRight size={18} /></button>
            </div>
          </div>

          {loading ? (
            <div className="p-16 flex justify-center text-gray-400"><Loader2 size={22} className="animate-spin" /></div>
          ) : (
            <div className="px-3 pb-4">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map(w => (
                  <div key={w} className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400 py-2">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {gridDates.map((d, i) => {
                  const inMonth = d.getMonth() === viewMonth;
                  const isToday = sameDay(d, today);
                  const dayEvents = eventsForDate(d);
                  const shown = dayEvents.slice(0, 2);
                  const extra = dayEvents.length - shown.length;
                  return (
                    <div
                      key={i}
                      onClick={() => (dayEvents.length ? setViewingEvents({ date: d, list: dayEvents }) : isManager ? openAddForm(d) : undefined)}
                      className={`min-h-[86px] rounded-xl p-2 border transition-colors ${inMonth ? 'bg-white border-gray-100' : 'bg-gray-50/50 border-transparent'} ${dayEvents.length || isManager ? 'cursor-pointer hover:border-terracotta/30' : ''}`}
                    >
                      <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-terracotta text-white' : inMonth ? 'text-ink' : 'text-gray-300'}`}>
                        {d.getDate()}
                      </div>
                      <div className="space-y-1">
                        {shown.map(e => (
                          <div key={e.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate ${typeMeta(e.type).badge}`} title={e.title}>
                            {e.title}
                          </div>
                        ))}
                        {extra > 0 && <div className="text-[10px] text-gray-400 font-medium px-1.5">+{extra} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming list */}
        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 h-fit">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
            <Clock size={14} /> Upcoming
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Nothing on the calendar yet.</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map(({ event, occursOn }) => {
                const daysUntil = Math.round((occursOn.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
                return (
                  <button
                    key={event.id}
                    onClick={() => setViewingEvents({ date: occursOn, list: [event] })}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${typeMeta(event.type).dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink truncate">{event.title}</p>
                      <p className="text-xs text-gray-400">
                        {occursOn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Day detail / event list modal */}
      {viewingEvents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setViewingEvents(null)}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink">
                {viewingEvents.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <button onClick={() => setViewingEvents(null)} className="text-gray-400 hover:text-ink transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              {viewingEvents.list.map(e => (
                <div key={e.id} className="p-4 rounded-2xl bg-cream border border-gray-100">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${typeMeta(e.type).badge}`}>
                      {typeMeta(e.type).label}
                    </span>
                    {e.recurringAnnually && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><Repeat size={11} /> Repeats yearly</span>
                    )}
                  </div>
                  <p className="font-bold text-ink mt-1">{e.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {e.date}{e.endDate && e.endDate !== e.date ? ` – ${e.endDate}` : ''}
                  </p>
                  {e.notes && (
                    <p className="text-sm text-gray-600 mt-2 flex items-start gap-1.5">
                      <StickyNote size={13} className="mt-0.5 shrink-0 text-gray-400" /> {e.notes}
                    </p>
                  )}
                  {isManager && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                      <button onClick={() => openEditForm(e)} className="flex items-center gap-1.5 text-xs font-bold text-olive hover:text-terracotta transition-colors">
                        <Edit2 size={13} /> Edit
                      </button>
                      <button onClick={() => handleDelete(e)} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {isManager && (
              <button
                onClick={() => openAddForm(viewingEvents.date)}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm font-bold text-gray-400 hover:border-terracotta hover:text-terracotta transition-colors"
              >
                <Plus size={16} /> Add another event on this day
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit form modal */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeForm}>
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-ink text-lg">{editingEvent ? 'Edit Event' : 'Add Event'}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-ink transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title</label>
                <input
                  value={formData.title || ''}
                  onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Songkran, Liquor Licence Renewal…"
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-terracotta outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Type</label>
                <select
                  value={formData.type || 'holiday'}
                  onChange={e => setFormData(f => ({ ...f, type: e.target.value as CalendarEvent['type'] }))}
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-terracotta outline-none"
                >
                  {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Date</label>
                  <input
                    type="date"
                    value={formData.date || ''}
                    onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-terracotta outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">End date (optional)</label>
                  <input
                    type="date"
                    value={formData.endDate || ''}
                    onChange={e => setFormData(f => ({ ...f, endDate: e.target.value }))}
                    placeholder="Multi-day event"
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-terracotta outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.recurringAnnually}
                  onChange={e => setFormData(f => ({ ...f, recurringAnnually: e.target.checked }))}
                  className="w-4 h-4 rounded accent-terracotta"
                />
                <span className="text-sm font-medium text-ink">Repeats every year on this date</span>
              </label>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes (optional)</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  placeholder="Anything staff should know…"
                  className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-terracotta outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                {saving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Add Event'}
              </button>
              <button onClick={closeForm} className="px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
