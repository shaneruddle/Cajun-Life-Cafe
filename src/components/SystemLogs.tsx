import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  Timestamp,
  where
} from 'firebase/firestore';
import { db } from '../firebase';
import { SystemLog } from '../types';
import { 
  Database, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Tag, 
  ChevronLeft, 
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

const LOG_CATEGORIES = [
  { id: 'all',         label: 'All Activities' },
  { id: 'finance',     label: 'Finance' },
  { id: 'loyalty',     label: 'Loyalty' },
  { id: 'crm',         label: 'CRM' },
  { id: 'menu',        label: 'Menu' },
  { id: 'category',    label: 'Categories' },
  { id: 'custom_meal', label: 'Custom Meals' },
  { id: 'user',        label: 'Users' },
  { id: 'image',       label: 'Images' },
  { id: 'calendar',    label: 'Calendar' },
  { id: 'system',      label: 'System' }
];

const CategoryBadge = ({ category }: { category: SystemLog['category'] }) => {
  const styles: Record<string, string> = {
    menu: 'bg-blue-50 text-blue-600 border-blue-100',
    category: 'bg-purple-50 text-purple-600 border-purple-100',
    custom_meal: 'bg-orange-50 text-orange-600 border-orange-100',
    finance: 'bg-green-50 text-green-600 border-green-100',
    user: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    image: 'bg-pink-50 text-pink-600 border-pink-100',
    loyalty: 'bg-amber-50 text-amber-600 border-amber-100',
    crm: 'bg-teal-50 text-teal-600 border-teal-100',
    calendar: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    system: 'bg-gray-50 text-gray-600 border-gray-100'
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[category] || styles.system}`}>
      {category.replace('_', ' ')}
    </span>
  );
};

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setLoading(true);
    let q = query(
      collection(db, 'system_logs'),
      orderBy('timestamp', 'desc'),
      limit(pageSize)
    );

    if (activeCategory !== 'all') {
      q = query(
        collection(db, 'system_logs'),
        where('category', '==', activeCategory),
        orderBy('timestamp', 'desc'),
        limit(pageSize)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SystemLog[];
      setLogs(logData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeCategory, pageSize]);

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-terracotta/10 p-4 rounded-2xl text-terracotta">
            <Database size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-ink">System Logs</h1>
            <p className="text-gray-500">Monitor all dashboard activities and changes.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 w-64"
            />
          </div>
          <select 
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-4 py-2 bg-white border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-terracotta/20 text-sm font-medium"
          >
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {LOG_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeCategory === cat.id
                ? 'bg-terracotta text-white shadow-md'
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">User</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Category</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Action</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <RefreshCw className="animate-spin mx-auto text-terracotta mb-4" size={32} />
                      <p className="text-gray-500">Loading system logs...</p>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <AlertCircle size={32} />
                      </div>
                      <p className="text-gray-500 font-medium">No logs found matching your criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <motion.tr 
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-500 text-sm">
                          <Clock size={14} />
                          {format(new Date(log.timestamp), 'MMM d, HH:mm:ss')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                            {log.userEmail[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-ink truncate max-w-[150px]" title={log.userEmail}>
                            {log.userEmail}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <CategoryBadge category={log.category} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-ink">{log.action}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-500 line-clamp-1 max-w-xs" title={log.details}>
                          {log.details}
                        </p>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {!loading && filteredLogs.length > 0 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400 font-medium">
              Showing latest {filteredLogs.length} activities
            </p>
            <div className="flex items-center gap-2">
              <button disabled className="p-1.5 rounded-lg border border-gray-200 text-gray-300 cursor-not-allowed">
                <ChevronLeft size={18} />
              </button>
              <button disabled className="p-1.5 rounded-lg border border-gray-200 text-gray-300 cursor-not-allowed">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
