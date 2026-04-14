import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where, Timestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from 'recharts';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  X,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfDay, endOfDay, subMonths, isValid, parse } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { handleFirestoreError } from '../../utils/firestore';
import { OperationType } from '../../types';
import { logActivity } from '../../utils/logger';
import FinanceAI from './FinanceAI';

interface FinanceCategory {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'dividend';
  uid: string;
}

interface FinanceEntry {
  id: string;
  type: 'income' | 'expense' | 'dividend';
  amount: number;
  categoryId: string;
  categoryName: string;
  description: string;
  date: string;
  createdBy: string;
  createdAt: string;
  uid: string;
  receiptUrls?: string[];
  lineItems?: { description: string; amount: number; quantity?: number; weight?: string }[];
}

const FinanceDashboard: React.FC = () => {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'entries' | 'categories' | 'reports' | 'ai'>('entries');
  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense' | 'dividend'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // Modals
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceEntry | null>(null);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [modalLineItems, setModalLineItems] = useState<{ description: string; amount: number; quantity?: number; weight?: string }[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (showEntryModal) {
      if (editingEntry) {
        setModalLineItems(editingEntry.lineItems || []);
      } else {
        setModalLineItems([]);
      }
    }
  }, [editingEntry, showEntryModal]);

  useEffect(() => {
    const qEntries = query(collection(db, 'finance_entries'), orderBy('date', 'desc'));
    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceEntry[];
      setEntries(data);
      setLoading(false);
    });

    const qCategories = query(collection(db, 'finance_categories'), orderBy('name', 'asc'));
    const unsubscribeCategories = onSnapshot(qCategories, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceCategory[];
      setCategories(data);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeCategories();
    };
  }, []);

  const normalizeDate = (d: any) => {
    if (!d) return '';
    const dateStr = typeof d === 'string' ? d : 
                   (d && typeof (d as any).toDate === 'function') ? (d as any).toDate().toISOString() : '';
    
    if (!dateStr) return '';

    // Try to extract YYYY-MM-DD or YYYY-M-D
    const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      const date = new Date(year, month - 1, day);
      if (isValid(date)) return format(date, 'yyyy-MM-dd');
    }

    // Try MM/DD/YYYY
    const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const month = parseInt(slashMatch[1]);
      const day = parseInt(slashMatch[2]);
      const year = parseInt(slashMatch[3]);
      const date = new Date(year, month - 1, day);
      if (isValid(date)) return format(date, 'yyyy-MM-dd');
    }

    // Fallback to native Date for other formats
    const nativeDate = new Date(dateStr);
    if (isValid(nativeDate)) return format(nativeDate, 'yyyy-MM-dd');

    return dateStr.substring(0, 10);
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           entry.categoryName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || entry.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || entry.categoryId === categoryFilter;
      
      const datePart = normalizeDate(entry.date);
      
      if (datePart.length >= 10) {
        const matchesDate = datePart >= dateRange.start && datePart <= dateRange.end;
        return matchesSearch && matchesType && matchesCategory && matchesDate;
      }

      return false;
    });
  }, [entries, searchTerm, typeFilter, categoryFilter, dateRange]);

  const filteredStats = useMemo(() => {
    const income = filteredEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc, 0);
    const expenses = filteredEntries.reduce((acc, curr) => curr.type === 'expense' ? acc + curr.amount : acc, 0);
    const dividends = filteredEntries.reduce((acc, curr) => curr.type === 'dividend' ? acc + curr.amount : acc, 0);
    return {
      income,
      expenses,
      dividends,
      balance: income - expenses - dividends,
      profit: income - expenses
    };
  }, [filteredEntries]);

  const allTimeStats = useMemo(() => {
    const income = entries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc, 0);
    const expenses = entries.reduce((acc, curr) => curr.type === 'expense' ? acc + curr.amount : acc, 0);
    const dividends = entries.reduce((acc, curr) => curr.type === 'dividend' ? acc + curr.amount : acc, 0);
    return {
      income,
      expenses,
      dividends,
      balance: income - expenses - dividends,
      profit: income - expenses
    };
  }, [entries]);

  const reportEntries = useMemo(() => {
    return entries.filter(entry => {
      const datePart = normalizeDate(entry.date);
      
      if (datePart.length >= 10) {
        return datePart >= dateRange.start && datePart <= dateRange.end;
      }
      return false;
    });
  }, [entries, dateRange]);

  const reportStats = useMemo(() => {
    const income = reportEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc, 0);
    const expenses = reportEntries.reduce((acc, curr) => curr.type === 'expense' ? acc + curr.amount : acc, 0);
    const dividends = reportEntries.reduce((acc, curr) => curr.type === 'dividend' ? acc + curr.amount : acc, 0);
    return {
      income,
      expenses,
      dividends,
      balance: income - expenses - dividends,
      profit: income - expenses
    };
  }, [reportEntries]);

  const currentMonthKey = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return 'all';
    try {
      const start = parseISO(dateRange.start);
      const end = parseISO(dateRange.end);
      if (isValid(start) && isValid(end) && 
          format(start, 'yyyy-MM-dd') === format(startOfMonth(start), 'yyyy-MM-dd') &&
          format(end, 'yyyy-MM-dd') === format(endOfMonth(end), 'yyyy-MM-dd') &&
          format(start, 'yyyy-MM') === format(end, 'yyyy-MM')) {
        return format(start, 'yyyy-MM');
      }
    } catch (e) {
      // ignore
    }
    return 'custom';
  }, [dateRange]);

  const handleMonthChange = (monthKey: string) => {
    if (monthKey === 'all') {
      handleShowAllTime();
      return;
    }
    if (monthKey === 'custom') return;

    try {
      const date = parseISO(`${monthKey}-01`);
      if (isValid(date)) {
        setDateRange({
          start: format(startOfMonth(date), 'yyyy-MM-dd'),
          end: format(endOfMonth(date), 'yyyy-MM-dd')
        });
      }
    } catch (e) {
      console.error("Month change error:", e);
    }
  };

  const isFiltered = searchTerm !== '' || categoryFilter !== 'all' || 
                    dateRange.start !== format(startOfMonth(new Date()), 'yyyy-MM-dd') || 
                    dateRange.end !== format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setDateRange({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });
  };

  const handleShowAllTime = () => {
    if (entries.length === 0) return;
    
    // Extract date strings and find min/max using string comparison
    const dateStrings = entries
      .map(e => normalizeDate(e.date))
      .filter(d => d.length === 10);
    
    if (dateStrings.length === 0) return;
    
    dateStrings.sort();
    const minDate = dateStrings[0];
    const maxDate = dateStrings[dateStrings.length - 1];
    
    setDateRange({
      start: minDate,
      end: maxDate
    });
  };

  const monthlyHistory = useMemo(() => {
    if (entries.length === 0) return [];
    
    const history: { month: string; income: number; expenses: number; dividends: number; monthKey: string }[] = [];
    const now = new Date();
    
    // Find oldest entry to determine how far back to go
    const dateStrings = entries
      .map(e => normalizeDate(e.date))
      .filter(d => d.length === 10);
    
    dateStrings.sort();
    const oldestDate = dateStrings.length > 0 ? parseISO(dateStrings[0]) : subMonths(now, 11);
    
    // Generate months from oldest entry until now (at least 12 months)
    let current = startOfMonth(oldestDate);
    const end = startOfMonth(now);
    
    // Ensure at least 12 months if oldest is recent
    const twelveMonthsAgo = startOfMonth(subMonths(now, 11));
    if (current > twelveMonthsAgo) {
      current = twelveMonthsAgo;
    }

    while (current <= end) {
      const monthKey = format(current, 'yyyy-MM');
      const monthLabel = format(current, 'MMM yyyy');
      
      const monthEntries = entries.filter(e => {
        const datePart = normalizeDate(e.date);
        return datePart.startsWith(monthKey);
      });
      
      const income = monthEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc, 0);
      const expenses = monthEntries.reduce((acc, curr) => curr.type === 'expense' ? acc + curr.amount : acc, 0);
      const dividends = monthEntries.reduce((acc, curr) => curr.type === 'dividend' ? acc + curr.amount : acc, 0);
      
      history.push({ month: monthLabel, income, expenses, dividends, monthKey });
      current = startOfMonth(subMonths(current, -1)); // Move to next month
    }
    
    return history;
  }, [entries]);

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryId = formData.get('categoryId') as string;
    const category = categories.find(c => c.id === categoryId);

    const dateValue = formData.get('date');
    const normalizedDate = normalizeDate(dateValue);

    if (!normalizedDate) {
      toast.error('Please select a valid date');
      return;
    }

    const baseData = {
      type: formData.get('type') as 'income' | 'expense' | 'dividend',
      amount: Number(formData.get('amount')),
      categoryId,
      categoryName: category?.name || 'Unknown',
      description: formData.get('description') as string,
      date: normalizedDate,
      updatedAt: new Date().toISOString(),
      lineItems: modalLineItems
    };

    try {
      if (editingEntry) {
        await updateDoc(doc(db, 'finance_entries', editingEntry.id), baseData);
        await logActivity('Finance Entry Updated', `Updated ${baseData.type}: ${baseData.description} (฿${baseData.amount})`, 'finance');
        toast.success('Entry updated successfully');
      } else {
        const fullData = {
          ...baseData,
          createdBy: auth.currentUser?.email || 'Unknown',
          createdAt: new Date().toISOString(),
          uid: auth.currentUser?.uid
        };
        await addDoc(collection(db, 'finance_entries'), fullData);
        await logActivity('Finance Entry Created', `Created ${baseData.type}: ${baseData.description} (฿${baseData.amount})`, 'finance');
        toast.success('Entry added successfully');
      }
      setShowEntryModal(false);
      setEditingEntry(null);
    } catch (error) {
      toast.error('Failed to save entry');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this entry?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'finance_entries', id));
          await logActivity('Finance Entry Deleted', `Deleted finance entry ID: ${id}`, 'finance');
          toast.success('Entry deleted');
        } catch (error) {
          toast.error('Failed to delete entry');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleAddCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const categoryData = {
      name: formData.get('name') as string,
      type: formData.get('type') as 'income' | 'expense' | 'dividend',
      uid: auth.currentUser?.uid
    };

    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'finance_categories', editingCategory.id), categoryData);
        await logActivity('Finance Category Updated', `Updated finance category: ${categoryData.name}`, 'finance');
        toast.success('Category updated');
      } else {
        await addDoc(collection(db, 'finance_categories'), categoryData);
        await logActivity('Finance Category Created', `Created finance category: ${categoryData.name}`, 'finance');
        toast.success('Category added');
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const hasEntries = entries.some(e => e.categoryId === id);
    if (hasEntries) {
      toast.error('Cannot delete category with existing entries');
      return;
    }

    setConfirmModal({
      show: true,
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'finance_categories', id));
          await logActivity('Finance Category Deleted', `Deleted finance category ID: ${id}`, 'finance');
          toast.success('Category deleted');
        } catch (error) {
          toast.error('Failed to delete category');
        }
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleMergeDuplicateEntries = async () => {
    setConfirmModal({
      show: true,
      title: 'Merge Duplicate Entries',
      message: 'This will find and remove duplicate finance entries with the same date, amount, type, category, and description. Continue?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        try {
          const groups: Record<string, any[]> = {};
          entries.forEach(entry => {
            const datePart = normalizeDate(entry.date);
            const key = `${datePart}_${entry.amount}_${entry.type}_${entry.categoryId}_${entry.description.toLowerCase().trim()}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
          });

          let removedCount = 0;
          for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
              // Keep the first one, delete the rest
              const duplicates = group.slice(1);
              for (const duplicate of duplicates) {
                await deleteDoc(doc(db, 'finance_entries', duplicate.id));
                removedCount++;
              }
            }
          }

          if (removedCount > 0) {
            toast.success(`Successfully removed ${removedCount} duplicate entries!`);
          } else {
            toast.info('No duplicate entries found.');
          }
        } catch (error) {
          console.error('Merge error:', error);
          toast.error('Failed to merge duplicate entries');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCleanupDuplicates = async () => {
    setConfirmModal({
      show: true,
      title: 'Clean Up Duplicates',
      message: 'This will merge categories with the same name and type. Existing entries will be moved to the primary category. Continue?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        try {
          const groups: Record<string, FinanceCategory[]> = {};
          categories.forEach(cat => {
            const key = `${cat.name.toLowerCase()}_${cat.type}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(cat);
          });

          let mergedCount = 0;
          for (const key in groups) {
            const group = groups[key];
            if (group.length > 1) {
              const master = group[0];
              const duplicates = group.slice(1);

              for (const duplicate of duplicates) {
                // Find entries using this duplicate category
                const affectedEntries = entries.filter(e => e.categoryId === duplicate.id);
                
                // Update entries to point to master
                for (const entry of affectedEntries) {
                  await updateDoc(doc(db, 'finance_entries', entry.id), {
                    categoryId: master.id,
                    categoryName: master.name
                  });
                }

                // Delete the duplicate category
                await deleteDoc(doc(db, 'finance_categories', duplicate.id));
                mergedCount++;
              }
            }
          }

          if (mergedCount > 0) {
            toast.success(`Successfully merged ${mergedCount} duplicate categories!`);
          } else {
            toast.info('No duplicate categories found.');
          }
        } catch (error) {
          console.error('Cleanup error:', error);
          toast.error('Failed to clean up duplicates');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleClearAllEntries = async () => {
    setConfirmModal({
      show: true,
      title: 'Clear All Entries',
      message: 'Are you absolutely sure you want to delete ALL finance entries? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        try {
          const q = query(collection(db, 'finance_entries'));
          const snapshot = await getDocs(q);
          
          let count = 0;
          const total = snapshot.docs.length;
          
          if (total === 0) {
            toast.info('No entries found to delete.');
            setLoading(false);
            return;
          }

          for (const docSnap of snapshot.docs) {
            try {
              await deleteDoc(doc(db, 'finance_entries', docSnap.id));
              count++;
            } catch (err) {
              handleFirestoreError(err, 'delete', `finance_entries/${docSnap.id}`);
            }
          }

          toast.success(`Successfully deleted ${count} finance entries!`);
        } catch (err: any) {
          console.error("Delete error:", err);
          toast.error(`Delete failed: ${err.message}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  if (loading) return <div className="pt-32 text-center">Loading Finance Data...</div>;

  return (
    <div className="pb-12 px-4 sm:px-6 lg:px-8 bg-cream min-h-screen pt-8">
      <div className="max-w-7xl mx-auto">
        {/* Header & Stats */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold text-ink mb-2">Finance Management</h1>
            <p className="text-gray-500">Manage your income, expenses, and financial reports.</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/dashboard/finance/import"
              className="bg-white text-ink border border-gray-200 px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
            >
              <Download size={18} className="text-terracotta" /> Import CSV
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                    <TrendingUp size={24} />
                  </div>
                  <span className="text-gray-500 font-medium">Total Income</span>
                </div>
                {isFiltered && <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-1 rounded-lg uppercase tracking-wider">Filtered</span>}
              </div>
              <div className="text-2xl font-bold text-ink">฿{Math.round(isFiltered ? filteredStats.income : allTimeStats.income).toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                {isFiltered ? 'For selected period' : 'All-time total'}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                    <TrendingDown size={24} />
                  </div>
                  <span className="text-gray-500 font-medium">Total Expenses</span>
                </div>
                {isFiltered && <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-1 rounded-lg uppercase tracking-wider">Filtered</span>}
              </div>
              <div className="text-2xl font-bold text-ink">฿{Math.round(isFiltered ? filteredStats.expenses : allTimeStats.expenses).toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                {isFiltered ? 'For selected period' : 'All-time total'}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                    <ArrowDownRight size={24} />
                  </div>
                  <span className="text-gray-500 font-medium">Dividends Paid</span>
                </div>
                {isFiltered && <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-1 rounded-lg uppercase tracking-wider">Filtered</span>}
              </div>
              <div className="text-2xl font-bold text-ink">฿{Math.round(isFiltered ? filteredStats.dividends : allTimeStats.dividends).toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                {isFiltered ? 'For selected period' : 'All-time total'}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-terracotta/10 text-terracotta rounded-2xl">
                    <Wallet size={24} />
                  </div>
                  <span className="text-gray-500 font-medium">Net Profit</span>
                </div>
                {isFiltered && <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-1 rounded-lg uppercase tracking-wider">Filtered</span>}
              </div>
              <div className="text-2xl font-bold text-ink">฿{Math.round(isFiltered ? filteredStats.profit : allTimeStats.profit).toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                {isFiltered ? 'Operating Profit (Income - Expenses)' : 'All-time total'}
              </div>
            </div>
          </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 bg-white p-2 rounded-full shadow-sm border border-gray-100 w-fit">
          <button 
            onClick={() => setActiveTab('entries')}
            className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'entries' ? 'bg-terracotta text-white' : 'text-gray-500 hover:text-ink'}`}
          >
            Entries
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'categories' ? 'bg-terracotta text-white' : 'text-gray-500 hover:text-ink'}`}
          >
            Categories
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'reports' ? 'bg-terracotta text-white' : 'text-gray-500 hover:text-ink'}`}
          >
            Reports
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${activeTab === 'ai' ? 'bg-terracotta text-white' : 'text-gray-500 hover:text-ink'}`}
          >
            AI Assistant
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'entries' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 flex-1">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  />
                </div>
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none"
                >
                  <option value="all">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="dividend">Dividend</option>
                </select>
                <select 
                  value={currentMonthKey}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-terracotta font-bold"
                >
                  <option value="all">All Time</option>
                  <option value="custom" disabled>Custom Range</option>
                  {[...monthlyHistory].reverse().map(item => (
                    <option key={item.monthKey} value={item.monthKey}>{item.month}</option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none"
                  />
                  <span className="text-gray-400">to</span>
                  <input 
                    type="date" 
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                {isFiltered && (
                  <button 
                    onClick={handleResetFilters}
                    className="text-gray-400 hover:text-ink px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    Reset
                  </button>
                )}
                <button 
                  onClick={() => {
                    setEditingEntry(null);
                    setShowEntryModal(true);
                  }}
                  className="bg-terracotta text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-terracotta/90 transition-all"
                >
                  <Plus size={18} /> Add Entry
                </button>
              </div>
            </div>

            {/* Entries Table */}
            <div className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Type</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Category</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Description</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">Amount</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400">By</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr 
                      key={entry.id} 
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        setEditingEntry(entry);
                        setShowEntryModal(true);
                      }}
                    >
                      <td className="px-6 py-4 text-sm text-ink font-medium">
                        {(() => {
                          try {
                            const dateStr = normalizeDate(entry.date);
                            if (!dateStr) return 'No Date';
                            const d = parseISO(dateStr);
                            return isNaN(d.getTime()) ? 'Invalid Date' : format(d, 'MMM dd, yyyy');
                          } catch {
                            return 'Invalid Date';
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          entry.type === 'income' ? 'bg-green-50 text-green-600' : 
                          entry.type === 'expense' ? 'bg-red-50 text-red-600' : 
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{entry.categoryName}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span>{entry.description || '-'}</span>
                          {entry.lineItems && entry.lineItems.length > 0 && (
                            <button 
                              onClick={(e) => toggleExpand(entry.id, e)}
                              className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 transition-all"
                            >
                              {expandedEntries.has(entry.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </div>
                        <AnimatePresence>
                          {entry.lineItems && entry.lineItems.length > 0 && expandedEntries.has(entry.id) && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 space-y-1 border-l-2 border-terracotta/20 pl-3 py-1">
                                {entry.lineItems.map((item, idx) => (
                                  <div key={idx} className="text-[10px] text-gray-400 flex gap-2">
                                    <span className="font-bold">• {item.description}</span>
                                    {item.quantity && <span>(x{item.quantity})</span>}
                                    {item.weight && <span>({item.weight})</span>}
                                    <span>฿{item.amount.toLocaleString()}</span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                      <td className={`px-6 py-4 text-xs font-bold ${
                        entry.type === 'income' ? 'text-green-600' : 
                        entry.type === 'expense' ? 'text-red-600' : 
                        'text-blue-600'
                      }`}>
                        {entry.type === 'income' ? '+' : '-'}฿{Math.round(entry.amount).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-[10px] text-gray-400 font-medium">{entry.createdBy}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEntry(entry);
                              setShowEntryModal(true);
                            }}
                            className="p-2 text-gray-400 hover:text-terracotta transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteEntry(entry.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-gray-50 rounded-full text-gray-300">
                            <Search size={32} />
                          </div>
                          <p className="text-gray-500 font-medium">No entries found matching your filters.</p>
                          {isFiltered && (
                            <button 
                              onClick={handleResetFilters}
                              className="text-terracotta font-bold hover:underline"
                            >
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div className="flex justify-end gap-2">
              <button 
                onClick={handleCleanupDuplicates}
                className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
                title="Merge categories with the same name and type"
              >
                <Copy size={18} className="text-terracotta" /> Cleanup Duplicates
              </button>
              <button 
                onClick={() => {
                  setEditingCategory(null);
                  setShowCategoryModal(true);
                }}
                className="bg-terracotta text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-terracotta/90 transition-all"
              >
                <Plus size={18} /> Add Category
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Income Categories */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-ink mb-6 flex items-center gap-2">
                  <ArrowUpRight className="text-green-500" /> Income Categories
                </h2>
                <div className="space-y-3">
                  {categories.filter(c => c.type === 'income').map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="font-medium text-ink">{cat.name}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setShowCategoryModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-terracotta transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expense Categories */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-ink mb-6 flex items-center gap-2">
                  <ArrowDownRight className="text-red-500" /> Expense Categories
                </h2>
                <div className="space-y-3">
                  {categories.filter(c => c.type === 'expense').map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="font-medium text-ink">{cat.name}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setShowCategoryModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-terracotta transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dividend Categories */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-ink mb-6 flex items-center gap-2">
                  <ArrowDownRight className="text-blue-500" /> Dividend Categories
                </h2>
                <div className="space-y-3">
                  {categories.filter(c => c.type === 'dividend').map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="font-medium text-ink">{cat.name}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setShowCategoryModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-terracotta transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
              <div className="space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                  <div>
                    <h2 className="text-3xl font-bold text-ink">Financial Performance</h2>
                    <p className="text-gray-500 mt-1">Detailed breakdown for {(() => {
                      try {
                        const d = parseISO(dateRange.start);
                        return isNaN(d.getTime()) ? 'Selected Period' : format(d, 'MMMM yyyy');
                      } catch {
                        return 'Selected Period';
                      }
                    })()}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 ml-1">Select Month</label>
                      <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-2xl border border-gray-100">
                        <Calendar size={18} className="text-gray-400" />
                        <input 
                          type="month" 
                          value={(() => {
                            try {
                              const d = parseISO(dateRange.start);
                              return isNaN(d.getTime()) ? format(new Date(), 'yyyy-MM') : format(d, 'yyyy-MM');
                            } catch {
                              return format(new Date(), 'yyyy-MM');
                            }
                          })()}
                          onChange={(e) => {
                            try {
                              if (!e.target.value) return;
                              const date = parseISO(`${e.target.value}-01`);
                              if (isNaN(date.getTime())) return;
                              setDateRange({
                                start: format(startOfMonth(date), 'yyyy-MM-dd'),
                                end: format(endOfMonth(date), 'yyyy-MM-dd')
                              });
                            } catch (error) {
                              console.error('Error changing month:', error);
                            }
                          }}
                          className="bg-transparent border-none focus:outline-none font-bold text-ink text-sm"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleShowAllTime}
                      className="mt-5 px-6 py-3 bg-olive text-white rounded-2xl font-bold text-sm hover:bg-olive/90 transition-all shadow-lg shadow-olive/10"
                    >
                      All Time
                    </button>
                    <button className="mt-5 p-3 bg-gray-50 text-gray-500 rounded-2xl hover:bg-gray-100 transition-all border border-gray-100">
                      <Download size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-green-50 text-green-600 rounded-xl">
                        <ArrowUpRight size={20} />
                      </div>
                      <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Total Income</span>
                    </div>
                    <span className="text-3xl font-bold text-green-600">฿{reportStats.income.toLocaleString()}</span>
                  </div>
                  
                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                        <ArrowDownRight size={20} />
                      </div>
                      <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Total Expenses</span>
                    </div>
                    <span className="text-3xl font-bold text-red-600">฿{reportStats.expenses.toLocaleString()}</span>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                        <ArrowDownRight size={20} />
                      </div>
                      <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Dividends Paid</span>
                    </div>
                    <span className="text-3xl font-bold text-blue-600">฿{reportStats.dividends.toLocaleString()}</span>
                  </div>

                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 bg-olive/10 text-olive rounded-xl">
                        <TrendingUp size={20} />
                      </div>
                      <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Net Profit</span>
                    </div>
                    <span className={`text-3xl font-bold ${reportStats.profit >= 0 ? 'text-olive' : 'text-red-600'}`}>
                      {reportStats.profit >= 0 ? '+' : ''}฿{reportStats.profit.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Expense Breakdown */}
                  <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold text-ink mb-8 flex items-center gap-3">
                      <PieChart size={24} className="text-terracotta" /> Expense Breakdown
                    </h3>
                    <div className="space-y-8">
                      {categories.filter(c => c.type === 'expense').filter(cat => {
                        const total = reportEntries.filter(e => e.categoryId === cat.id).reduce((acc, curr) => acc + curr.amount, 0);
                        return total > 0;
                      }).length === 0 ? (
                        <div className="py-16 text-center text-gray-400 italic bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                          <AlertCircle size={40} className="mx-auto mb-4 opacity-20" />
                          No expenses recorded for this period.
                        </div>
                      ) : (
                        categories.filter(c => c.type === 'expense').map(cat => {
                          const catTotal = reportEntries
                            .filter(e => e.categoryId === cat.id)
                            .reduce((acc, curr) => acc + curr.amount, 0);
                          const percentage = reportStats.expenses > 0 ? (catTotal / reportStats.expenses) * 100 : 0;
                          
                          if (catTotal === 0) return null;

                          return (
                            <div key={cat.id} className="group">
                              <div className="flex justify-between text-sm mb-3">
                                <span className="text-gray-600 font-bold group-hover:text-ink transition-colors">{cat.name}</span>
                                <span className="text-ink font-bold">฿{catTotal.toLocaleString()} <span className="text-gray-400 font-normal ml-1">({percentage.toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className="h-full bg-terracotta rounded-full" 
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Income Breakdown */}
                  <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold text-ink mb-8 flex items-center gap-3">
                      <TrendingUp size={24} className="text-olive" /> Income Breakdown
                    </h3>
                    <div className="space-y-8">
                      {categories.filter(c => c.type === 'income').filter(cat => {
                        const total = reportEntries.filter(e => e.categoryId === cat.id).reduce((acc, curr) => acc + curr.amount, 0);
                        return total > 0;
                      }).length === 0 ? (
                        <div className="py-16 text-center text-gray-400 italic bg-gray-50 rounded-[32px] border border-dashed border-gray-200">
                          <AlertCircle size={40} className="mx-auto mb-4 opacity-20" />
                          No income recorded for this period.
                        </div>
                      ) : (
                        categories.filter(c => c.type === 'income').map(cat => {
                          const catTotal = reportEntries
                            .filter(e => e.categoryId === cat.id)
                            .reduce((acc, curr) => acc + curr.amount, 0);
                          const percentage = reportStats.income > 0 ? (catTotal / reportStats.income) * 100 : 0;
                          
                          if (catTotal === 0) return null;

                          return (
                            <div key={cat.id} className="group">
                              <div className="flex justify-between text-sm mb-3">
                                <span className="text-gray-600 font-bold group-hover:text-ink transition-colors">{cat.name}</span>
                                <span className="text-ink font-bold">฿{catTotal.toLocaleString()} <span className="text-gray-400 font-normal ml-1">({percentage.toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className="h-full bg-olive rounded-full" 
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Monthly History Trend Chart */}
                <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                  <h3 className="text-xl font-bold text-ink mb-8 flex items-center gap-3">
                    <TrendingUp size={24} className="text-olive" /> Financial Trends
                  </h3>
                  <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis 
                          dataKey="month" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          dy={10}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#9ca3af', fontSize: 12 }}
                          tickFormatter={(value) => `฿${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                        />
                        <Tooltip 
                          cursor={{ fill: '#f9fafb' }}
                          contentStyle={{ 
                            borderRadius: '20px', 
                            border: 'none', 
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            padding: '16px'
                          }}
                        />
                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                        <Bar dataKey="income" name="Income" fill="#5A5A40" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#FF6321" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="dividends" name="Dividends" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Monthly History Trend Table */}
                <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-ink flex items-center gap-3">
                      <Calendar size={24} className="text-olive" /> Monthly Breakdown
                    </h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Click a month to view details</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-gray-100">
                          <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Month</th>
                          <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Income</th>
                          <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Expenses</th>
                          <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Dividends</th>
                          <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-right">Net Profit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {monthlyHistory.slice().reverse().map((item, idx) => (
                          <tr key={idx} className="group hover:bg-gray-50/50 transition-colors">
                            <td className="py-5 font-bold text-ink">{item.month}</td>
                            <td className="py-5 text-right text-green-600 font-medium">฿{item.income.toLocaleString()}</td>
                            <td className="py-5 text-right text-red-600 font-medium">฿{item.expenses.toLocaleString()}</td>
                            <td className="py-5 text-right text-blue-600 font-medium">฿{item.dividends.toLocaleString()}</td>
                            <td className={`py-5 text-right font-bold ${item.income - item.expenses >= 0 ? 'text-olive' : 'text-red-600'}`}>
                              ฿{(item.income - item.expenses).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Annual Category Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold text-ink mb-8 flex items-center gap-3">
                      <PieChart size={24} className="text-terracotta" /> Annual Expense Breakdown ({new Date().getFullYear()})
                    </h3>
                    <div className="space-y-6">
                      {(() => {
                        const currentYear = new Date().getFullYear().toString();
                        const yearEntries = entries.filter(e => {
                          const entryDateStr = typeof e.date === 'string' ? e.date : 
                                              (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                          return entryDateStr.startsWith(currentYear) && e.type === 'expense';
                        });
                        const yearTotal = yearEntries.reduce((acc, curr) => acc + curr.amount, 0);
                        
                        if (yearTotal === 0) return <p className="text-gray-400 italic text-center py-8">No expenses recorded for {currentYear}</p>;

                        return categories.filter(c => c.type === 'expense').map(cat => {
                          const catTotal = yearEntries.filter(e => e.categoryId === cat.id).reduce((acc, curr) => acc + curr.amount, 0);
                          const percentage = yearTotal > 0 ? (catTotal / yearTotal) * 100 : 0;
                          if (catTotal === 0) return null;
                          return (
                            <div key={cat.id} className="group">
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600 font-bold group-hover:text-ink transition-colors">{cat.name}</span>
                                <span className="text-ink font-bold">฿{catTotal.toLocaleString()} <span className="text-gray-400 font-normal ml-1">({percentage.toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className="h-full bg-terracotta rounded-full" 
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div className="bg-white p-10 rounded-[48px] border border-gray-100 shadow-sm">
                    <h3 className="text-xl font-bold text-ink mb-8 flex items-center gap-3">
                      <TrendingUp size={24} className="text-olive" /> Annual Income Breakdown ({new Date().getFullYear()})
                    </h3>
                    <div className="space-y-6">
                      {(() => {
                        const currentYear = new Date().getFullYear().toString();
                        const yearEntries = entries.filter(e => {
                          const entryDateStr = typeof e.date === 'string' ? e.date : 
                                              (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                          return entryDateStr.startsWith(currentYear) && e.type === 'income';
                        });
                        const yearTotal = yearEntries.reduce((acc, curr) => acc + curr.amount, 0);
                        
                        if (yearTotal === 0) return <p className="text-gray-400 italic text-center py-8">No income recorded for {currentYear}</p>;

                        return categories.filter(c => c.type === 'income').map(cat => {
                          const catTotal = yearEntries.filter(e => e.categoryId === cat.id).reduce((acc, curr) => acc + curr.amount, 0);
                          const percentage = yearTotal > 0 ? (catTotal / yearTotal) * 100 : 0;
                          if (catTotal === 0) return null;
                          return (
                            <div key={cat.id} className="group">
                              <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-600 font-bold group-hover:text-ink transition-colors">{cat.name}</span>
                                <span className="text-ink font-bold">฿{catTotal.toLocaleString()} <span className="text-gray-400 font-normal ml-1">({percentage.toFixed(1)}%)</span></span>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className="h-full bg-olive rounded-full" 
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-10 rounded-[48px] border border-gray-100 flex flex-col md:flex-row justify-around items-center gap-8">
                  <div className="text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">Total Annual Expenses</p>
                    <span className="text-4xl font-bold text-red-600">
                      ฿{entries.filter(e => {
                        const entryDateStr = typeof e.date === 'string' ? e.date : 
                                            (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                        return entryDateStr.startsWith(new Date().getFullYear().toString()) && e.type === 'expense';
                      }).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-12 w-px bg-gray-200 hidden md:block" />
                  <div className="text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">Total Annual Income</p>
                    <span className="text-4xl font-bold text-green-600">
                      ฿{entries.filter(e => {
                        const entryDateStr = typeof e.date === 'string' ? e.date : 
                                            (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                        return entryDateStr.startsWith(new Date().getFullYear().toString()) && e.type === 'income';
                      }).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-12 w-px bg-gray-200 hidden md:block" />
                  <div className="text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">Total Annual Dividends</p>
                    <span className="text-4xl font-bold text-blue-600">
                      ฿{entries.filter(e => {
                        const entryDateStr = typeof e.date === 'string' ? e.date : 
                                            (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                        return entryDateStr.startsWith(new Date().getFullYear().toString()) && e.type === 'dividend';
                      }).reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="h-12 w-px bg-gray-200 hidden md:block" />
                  <div className="text-center">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-2">Avg. Monthly Profit</p>
                    <span className={`text-4xl font-bold ${(() => {
                      const yearEntries = entries.filter(e => {
                        const entryDateStr = typeof e.date === 'string' ? e.date : 
                                            (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                        return entryDateStr.startsWith(new Date().getFullYear().toString());
                      });
                      const profit = yearEntries.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : curr.type === 'expense' ? acc - curr.amount : acc, 0);
                      return profit >= 0 ? 'text-olive' : 'text-red-600';
                    })()}`}>
                      ฿{Math.abs(Math.round(entries.filter(e => {
                        const entryDateStr = typeof e.date === 'string' ? e.date : 
                                            (e.date && typeof (e.date as any).toDate === 'function') ? (e.date as any).toDate().toISOString() : '';
                        return entryDateStr.startsWith(new Date().getFullYear().toString());
                      }).reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : curr.type === 'expense' ? acc - curr.amount : acc, 0) / 12)).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="max-w-4xl mx-auto">
            <FinanceAI entries={entries} />
          </div>
        )}
      </div>

      {/* Entry Modal */}
      <AnimatePresence>
        {showEntryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-ink">{editingEntry ? 'Edit Entry' : 'Add New Entry'}</h2>
                <button onClick={() => setShowEntryModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddEntry} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Type</label>
                  <select 
                    name="type" 
                    defaultValue={editingEntry?.type || 'expense'}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="dividend">Dividend</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Category</label>
                  <select 
                    name="categoryId" 
                    defaultValue={editingEntry?.categoryId}
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Amount (฿)</label>
                  <input 
                    type="number" 
                    name="amount" 
                    defaultValue={editingEntry?.amount}
                    required 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Date</label>
                  <input 
                    type="date" 
                    name="date" 
                    defaultValue={normalizeDate(editingEntry?.date) || format(new Date(), 'yyyy-MM-dd')}
                    required 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Description</label>
                  <textarea 
                    name="description" 
                    defaultValue={editingEntry?.description}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 h-24"
                  />
                </div>

                {/* Line Items */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Line Items (Optional)</label>
                    <button 
                      type="button"
                      onClick={() => setModalLineItems([...modalLineItems, { description: '', amount: 0 }])}
                      className="text-terracotta text-xs font-bold flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                    {modalLineItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-2">
                          <input 
                            type="text"
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => {
                              const newItems = [...modalLineItems];
                              newItems[idx].description = e.target.value;
                              setModalLineItems(newItems);
                            }}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                          />
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              placeholder="Qty"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const newItems = [...modalLineItems];
                                newItems[idx].quantity = parseFloat(e.target.value);
                                setModalLineItems(newItems);
                              }}
                              className="w-16 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                            />
                            <input 
                              type="text"
                              placeholder="Weight"
                              value={item.weight || ''}
                              onChange={(e) => {
                                const newItems = [...modalLineItems];
                                newItems[idx].weight = e.target.value;
                                setModalLineItems(newItems);
                              }}
                              className="w-24 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm"
                            />
                            <input 
                              type="number"
                              placeholder="Amount"
                              value={item.amount || ''}
                              onChange={(e) => {
                                const newItems = [...modalLineItems];
                                newItems[idx].amount = parseFloat(e.target.value);
                                setModalLineItems(newItems);
                              }}
                              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none text-sm font-bold"
                            />
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            setModalLineItems(modalLineItems.filter((_, i) => i !== idx));
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 mt-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {editingEntry?.receiptUrls && editingEntry.receiptUrls.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Receipts</label>
                    <div className="flex flex-wrap gap-2">
                      {editingEntry.receiptUrls.map((url, idx) => (
                        <div 
                          key={idx} 
                          className="w-20 h-20 rounded-xl overflow-hidden border border-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewImage(url)}
                        >
                          <img src={url} alt={`Receipt ${idx + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" className="w-full bg-terracotta text-white py-4 rounded-2xl font-bold hover:bg-terracotta/90 transition-all">
                  {editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-ink">{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
                <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddCategory} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    defaultValue={editingCategory?.name}
                    required 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Type</label>
                  <select 
                    name="type" 
                    defaultValue={editingCategory?.type || 'expense'}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  >
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                    <option value="dividend">Dividend</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-terracotta text-white py-4 rounded-2xl font-bold hover:bg-terracotta/90 transition-all">
                  {editingCategory ? 'Update Category' : 'Save Category'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl p-8"
            >
              <h2 className="text-2xl font-bold text-ink mb-4">{confirmModal.title}</h2>
              <p className="text-gray-600 mb-8">{confirmModal.message}</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className="flex-1 px-6 py-3 rounded-2xl font-bold bg-terracotta text-white hover:bg-terracotta/90 transition-all"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/95 backdrop-blur-md cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={previewImage} 
                alt="Receipt Preview" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
              />
              <button 
                onClick={() => setPreviewImage(null)}
                className="absolute -top-12 right-0 p-2 text-white hover:text-terracotta transition-colors"
              >
                <X size={32} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FinanceDashboard;
