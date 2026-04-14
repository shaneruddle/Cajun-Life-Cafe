import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { Employee, OperationType } from '../../types';
import { handleFirestoreError } from '../../utils/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Edit2, X, UserPlus, Building2, Wallet, Calendar, Briefcase, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const POSITIONS = ['Manager', 'Chef', 'Sous Chef', 'Waiter', 'Waitress', 'Cashier', 'Barista', 'Cleaner', 'Kitchen Staff'];
const BANK_BRANCHES = ['Bangkok Bank', 'Kasikorn Bank', 'SCB', 'Krungthai Bank', 'GSB', 'Krungsri', 'TMBThanachart'];

const Payroll: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    baseSalary: '',
    position: POSITIONS[0],
    startDate: format(new Date(), 'yyyy-MM-dd'),
    bankBranch: BANK_BRANCHES[0],
    bankAccountNumber: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const emps = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Employee[];
      setEmployees(emps);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, 'list', 'employees');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModal = (emp: Employee | null = null) => {
    if (emp) {
      setEditingEmployee(emp);
      setFormData({
        firstName: emp.firstName,
        lastName: emp.lastName,
        baseSalary: emp.baseSalary.toString(),
        position: emp.position,
        startDate: emp.startDate,
        bankBranch: emp.bankBranch,
        bankAccountNumber: emp.bankAccountNumber
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        firstName: '',
        lastName: '',
        baseSalary: '',
        position: POSITIONS[0],
        startDate: format(new Date(), 'yyyy-MM-dd'),
        bankBranch: BANK_BRANCHES[0],
        bankAccountNumber: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const data = {
      ...formData,
      baseSalary: parseFloat(formData.baseSalary),
      uid: auth.currentUser.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingEmployee?.id) {
        await updateDoc(doc(db, 'employees', editingEmployee.id), data);
        toast.success('Employee updated successfully');
      } else {
        await addDoc(collection(db, 'employees'), {
          ...data,
          createdAt: new Date().toISOString()
        });
        toast.success('Employee added successfully');
      }
      setShowModal(false);
    } catch (err) {
      handleFirestoreError(err, editingEmployee ? 'update' : 'create', 'employees');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this employee?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      toast.success('Employee deleted successfully');
    } catch (err) {
      handleFirestoreError(err, 'delete', 'employees');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-ink">Payroll Management</h2>
          <p className="text-gray-500 mt-1">Manage your team and their payment details</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold text-sm hover:bg-terracotta/90 transition-all shadow-lg shadow-terracotta/20"
        >
          <UserPlus size={18} />
          Add Employee
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
        </div>
      ) : employees.length === 0 ? (
        <div className="bg-white p-20 rounded-[48px] border-2 border-dashed border-gray-100 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <User size={40} className="text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-ink mb-2">No employees yet</h3>
          <p className="text-gray-400 max-w-xs mx-auto mb-8">Start by adding your first team member to manage their payroll information.</p>
          <button 
            onClick={() => handleOpenModal()}
            className="px-8 py-3 bg-terracotta text-white rounded-2xl font-bold text-sm hover:bg-terracotta/90 transition-all"
          >
            Add First Employee
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={emp.id}
              className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-terracotta/10 text-terracotta rounded-2xl flex items-center justify-center font-bold text-xl">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-ink text-lg">{emp.firstName} {emp.lastName}</h3>
                    <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                      {emp.position}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => handleOpenModal(emp)}
                    className="p-2 text-gray-400 hover:text-terracotta hover:bg-terracotta/5 rounded-xl transition-all"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(emp.id!)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Wallet size={16} className="text-gray-400" />
                  <span className="text-gray-500">Base Salary:</span>
                  <span className="font-bold text-ink ml-auto">฿{emp.baseSalary.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={16} className="text-gray-400" />
                  <span className="text-gray-500">Started:</span>
                  <span className="font-bold text-ink ml-auto">{format(new Date(emp.startDate), 'MMM dd, yyyy')}</span>
                </div>
                <div className="pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-sm mb-2">
                    <Building2 size={16} className="text-gray-400" />
                    <span className="text-gray-500">{emp.bankBranch}</span>
                  </div>
                  <div className="text-xs font-mono text-gray-400 bg-gray-50 p-3 rounded-xl break-all">
                    {emp.bankAccountNumber}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Employee Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-2xl font-bold text-ink">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">First Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Last Name</label>
                    <input 
                      required
                      type="text" 
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Position</label>
                    <select 
                      value={formData.position}
                      onChange={(e) => setFormData({...formData, position: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                    >
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Base Salary (฿)</label>
                    <input 
                      required
                      type="number" 
                      value={formData.baseSalary}
                      onChange={(e) => setFormData({...formData, baseSalary: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                      placeholder="25000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Start Date</label>
                  <input 
                    required
                    type="date" 
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                  />
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-ink mb-4 flex items-center gap-2">
                    <Building2 size={16} className="text-terracotta" /> Bank Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Bank Branch</label>
                      <select 
                        value={formData.bankBranch}
                        onChange={(e) => setFormData({...formData, bankBranch: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                      >
                        {BANK_BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Account Number</label>
                      <input 
                        required
                        type="text" 
                        value={formData.bankAccountNumber}
                        onChange={(e) => setFormData({...formData, bankAccountNumber: e.target.value})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-terracotta/20"
                        placeholder="000-0-00000-0"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-terracotta text-white rounded-2xl font-bold hover:bg-terracotta/90 transition-all shadow-lg shadow-terracotta/20"
                  >
                    {editingEmployee ? 'Update Employee' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Payroll;
