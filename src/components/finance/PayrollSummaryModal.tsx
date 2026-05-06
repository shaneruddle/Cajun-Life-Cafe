import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Employee, PayrollSummary, FinanceEntry, OperationType } from '../../types';
import { handleFirestoreError } from '../../utils/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Download, Save, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, subMonths, eachMonthOfInterval } from 'date-fns';
import { toast } from 'sonner';

interface PayrollSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
}

const PayrollSummaryModal: React.FC<PayrollSummaryModalProps> = ({ isOpen, onClose, employees }) => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [advances, setAdvances] = useState<Record<string, number>>({});
  const [manualData, setManualData] = useState<Record<string, { deductions: number; bonuses: number; status: 'pending' | 'paid'; id?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Generate last 12 months for selection
  const months = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, 11);
    return eachMonthOfInterval({ start, end }).reverse().map(date => ({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    }));
  }, []);

  // Fetch advances and existing summaries for selected month
  useEffect(() => {
    if (!isOpen || !selectedMonth) return;

    setLoading(true);
    const start = format(startOfMonth(parseISO(`${selectedMonth}-01`)), 'yyyy-MM-dd');
    const end = format(endOfMonth(parseISO(`${selectedMonth}-01`)), 'yyyy-MM-dd');

    // Fetch finance entries that might be advances
    const qEntries = query(
      collection(db, 'finance_entries'),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    // Fetch existing summaries to populate manual data
    const qSummaries = query(
      collection(db, 'payroll_summaries'),
      where('month', '==', selectedMonth)
    );

    const unsubscribeEntries = onSnapshot(qEntries, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as FinanceEntry[];
      const advancesMap: Record<string, number> = {};
      
      entries.forEach(entry => {
        if (entry.employeeId && (
          entry.categoryName.toLowerCase().includes('advance') || 
          entry.description.toLowerCase().includes('advance')
        )) {
          advancesMap[entry.employeeId] = (advancesMap[entry.employeeId] || 0) + entry.amount;
        }
      });
      setAdvances(advancesMap);
    }, (err) => {
      handleFirestoreError(err, 'list', 'finance_entries');
    });

    const unsubscribeSummaries = onSnapshot(qSummaries, (snapshot) => {
      const summaries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PayrollSummary[];
      const manualMap: Record<string, { deductions: number; bonuses: number; status: 'pending' | 'paid'; id?: string }> = {};
      
      summaries.forEach(s => {
        manualMap[s.employeeId] = {
          deductions: s.deductions,
          bonuses: s.bonuses,
          status: s.status,
          id: s.id
        };
      });
      setManualData(manualMap);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, 'list', 'payroll_summaries');
      setLoading(false);
    });

    return () => {
      unsubscribeEntries();
      unsubscribeSummaries();
    };
  }, [isOpen, selectedMonth]);

  const handleManualChange = (empId: string, field: 'deductions' | 'bonuses', value: string) => {
    const numValue = parseFloat(value) || 0;
    setManualData(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { deductions: 0, bonuses: 0, status: 'pending' }),
        [field]: numValue
      }
    }));
  };

  const handleStatusToggle = (empId: string) => {
    setManualData(prev => ({
      ...prev,
      [empId]: {
        ...(prev[empId] || { deductions: 0, bonuses: 0, status: 'pending' }),
        status: (prev[empId]?.status === 'paid' ? 'pending' : 'paid')
      }
    }));
  };

  const handleSaveAll = async () => {
    if (!auth.currentUser) return;
    setSaving(true);

    try {
      const promises = employees.map(async (emp) => {
        const data = manualData[emp.id!] || { deductions: 0, bonuses: 0, status: 'pending' };
        const advanceAmt = advances[emp.id!] || 0;
        const totalDue = emp.baseSalary - advanceAmt - data.deductions + data.bonuses;

        const summaryData = {
          month: selectedMonth,
          employeeId: emp.id!,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          position: emp.position,
          baseSalary: emp.baseSalary,
          advances: advanceAmt,
          deductions: data.deductions,
          bonuses: data.bonuses,
          totalDue,
          status: data.status,
          updatedAt: new Date().toISOString(),
          uid: auth.currentUser!.uid
        };

        if (data.id) {
          await updateDoc(doc(db, 'payroll_summaries', data.id), summaryData);
        } else {
          await addDoc(collection(db, 'payroll_summaries'), {
            ...summaryData,
            createdAt: new Date().toISOString()
          });
        }
      });

      await Promise.all(promises);
      toast.success('Payroll summaries saved successfully');
    } catch (err) {
      handleFirestoreError(err, 'write', 'payroll_summaries');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-6xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-terracotta/10 text-terracotta rounded-2xl">
              <Calculator size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-ink">Payroll Summary</h2>
              <p className="text-sm text-gray-500">Calculate and review monthly payments</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm">
              <Calendar size={18} className="text-terracotta" />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-ink focus:outline-none"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
              <p className="text-gray-500 font-medium">Loading payroll data...</p>
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-20">
              <AlertCircle size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No employees found. Please add employees first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-4">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    <th className="px-6 py-2">Employee</th>
                    <th className="px-6 py-2">Position</th>
                    <th className="px-6 py-2 text-right">Base Salary</th>
                    <th className="px-6 py-2 text-right">Advances</th>
                    <th className="px-6 py-2 text-right">Deductions</th>
                    <th className="px-6 py-2 text-right">Bonuses</th>
                    <th className="px-6 py-2 text-right">Total Due</th>
                    <th className="px-6 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const empManual = manualData[emp.id!] || { deductions: 0, bonuses: 0, status: 'pending' };
                    const advanceAmt = advances[emp.id!] || 0;
                    const totalDue = emp.baseSalary - advanceAmt - empManual.deductions + empManual.bonuses;

                    return (
                      <tr key={emp.id} className="bg-gray-50/50 hover:bg-gray-50 transition-all group">
                        <td className="px-6 py-4 rounded-l-3xl">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white border border-gray-100 text-terracotta rounded-xl flex items-center justify-center font-bold">
                              {emp.firstName[0]}{emp.lastName[0]}
                            </div>
                            <span className="font-bold text-ink">{emp.firstName} {emp.lastName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg uppercase">
                            {emp.position}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-ink">
                          ฿{emp.baseSalary.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-red-500">
                          {advanceAmt > 0 ? `-฿${advanceAmt.toLocaleString()}` : '฿0'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input 
                            type="number"
                            value={empManual.deductions || ''}
                            onChange={(e) => handleManualChange(emp.id!, 'deductions', e.target.value)}
                            className="w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-right font-mono text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input 
                            type="number"
                            value={empManual.bonuses || ''}
                            onChange={(e) => handleManualChange(emp.id!, 'bonuses', e.target.value)}
                            className="w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-right font-mono text-green-600 focus:outline-none focus:ring-2 focus:ring-green-500/20"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`font-bold text-lg ${totalDue >= 0 ? 'text-ink' : 'text-red-600'}`}>
                            ฿{totalDue.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 rounded-r-3xl text-center">
                          <button 
                            onClick={() => handleStatusToggle(emp.id!)}
                            className={`p-2 rounded-xl transition-all ${
                              empManual.status === 'paid' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-yellow-100 text-yellow-600'
                            }`}
                            title={empManual.status === 'paid' ? 'Mark as Pending' : 'Mark as Paid'}
                          >
                            {empManual.status === 'paid' ? <CheckCircle2 size={20} /> : <Calendar size={20} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <AlertCircle size={16} className="text-terracotta" />
            <span>Advances are automatically calculated from finance entries with "Advance" in category or description.</span>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-white border border-gray-200 text-gray-500 rounded-2xl font-bold hover:bg-gray-50 transition-all"
            >
              Close
            </button>
            <button 
              onClick={handleSaveAll}
              disabled={saving || loading || employees.length === 0}
              className="px-8 py-3 bg-terracotta text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-terracotta/90 transition-all shadow-lg shadow-terracotta/20 disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
              ) : (
                <Save size={18} />
              )}
              Save Summary
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PayrollSummaryModal;
