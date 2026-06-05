import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CRMCustomer } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Calendar, 
  Star,
  Edit2,
  Trash2,
  UserPlus,
  Loader2,
  FileText,
  CheckCircle2,
  X,
  Send,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function CRMDirectory() {
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'loyalty' | 'new'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    countryCode: '+66',
    notes: '',
    status: 'active' as 'active' | 'inactive',
    lineUserId: '',
  });

  const adminEmail = auth.currentUser?.email || 'unknown';
  const adminUid = auth.currentUser?.uid || 'unknown';

  useEffect(() => {
    const q = query(collection(db, 'crm_customers'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CRMCustomer[];
      setCustomers(data);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, 'list', 'crm_customers');
    });
    return () => unsub();
  }, []);

  const filteredCustomers = useMemo(() => {
    let result = customers;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        (c.mobile ?? '').includes(searchQuery)
      );
    }
    if (filter === 'loyalty') result = result.filter(c => c.loyaltyEnabled);
    if (filter === 'new') result = result.filter(c => !c.loyaltyEnabled && (c.totalSpend ?? 0) < 100);
    return result;
  }, [customers, searchQuery, filter]);

  const handleEnroll = async (customer: CRMCustomer) => {
    if (!customer.id) return;
    if (customer.loyaltyEnabled) { toast.error('Already enrolled'); return; }
    setEnrollingId(customer.id);
    try {
      await updateDoc(doc(db, 'crm_customers', customer.id), {
        loyaltyEnabled: true,
        balance: 0,
        isVerified: true,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('Loyalty Enrollment', `Enrolled ${customer.firstName} ${customer.lastName} into loyalty program`, 'loyalty');
      toast.success(`${customer.firstName} enrolled in loyalty program!`);
    } catch (err) {
      console.error('Enrollment error:', err);
      toast.error('Failed to enroll customer');
    } finally {
      setEnrollingId(null);
    }
  };

  const generateActivationLink = async (customer: CRMCustomer) => {
    if (!customer.id) return;
    try {
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      await addDoc(collection(db, 'activation_tokens'), {
        token,
        crmCustomerId: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        mobile: customer.mobile,
        used: false,
        createdAt: new Date().toISOString(),
      });
      const link = `https://cajunlifecafe.com/activate/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success('Activation link copied to clipboard!', { duration: 5000 });
    } catch (err) {
      console.error('Failed to generate link:', err);
      toast.error('Failed to generate link');
    }
  };

  const openEditModal = (customer: CRMCustomer) => {
    setSelectedCustomerId(customer.id || null);
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email ?? '',
      mobile: customer.mobile ?? '',
      countryCode: '+66',
      notes: customer.notes || '',
      status: customer.status || 'active',
      lineUserId: customer.lineUserId || '',
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fullMobile = formData.mobile
        ? `${formData.countryCode}${formData.mobile.replace(/^0/, '')}`
        : '';

      if (selectedCustomerId) {
        await updateDoc(doc(db, 'crm_customers', selectedCustomerId), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobile: fullMobile || formData.mobile,
          notes: formData.notes,
          status: formData.status,
          lineUserId: formData.lineUserId,
          updatedAt: new Date().toISOString(),
        });
        await logActivity('Customer Updated', `Updated: ${formData.firstName} ${formData.lastName}`, 'crm');
        toast.success('Customer updated');
      } else {
        const docRef = await addDoc(collection(db, 'crm_customers'), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          mobile: fullMobile || formData.mobile,
          notes: formData.notes,
          status: formData.status,
          lineUserId: formData.lineUserId || '',
          totalSpend: 0,
          uid: adminUid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        // Auto-generate activation link for LINE linking
        const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        await addDoc(collection(db, 'activation_tokens'), {
          token,
          crmCustomerId: docRef.id,
          firstName: formData.firstName,
          lastName: formData.lastName,
          mobile: fullMobile || formData.mobile,
          used: false,
          createdAt: new Date().toISOString(),
        });
        const link = `https://cajunlifecafe.com/activate/${token}`;
        navigator.clipboard.writeText(link).catch(() => {});
        await logActivity('Customer Added', `Added: ${formData.firstName} ${formData.lastName}`, 'crm');
        toast.success(`Customer added! Activation link copied.`, { duration: 8000 });
      }
      setShowAddModal(false);
      setSelectedCustomerId(null);
      setFormData({ firstName: '', lastName: '', email: '', mobile: '', countryCode: '+66', notes: '', status: 'active', lineUserId: '' });
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: CRMCustomer) => {
    if (!customer.id) return;
    if (!window.confirm(`Delete ${customer.firstName} ${customer.lastName}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'crm_customers', customer.id));
      await logActivity('Customer Deleted', `Deleted: ${customer.firstName} ${customer.lastName}`, 'crm');
      toast.success('Customer deleted');
      setShowAddModal(false);
      setSelectedCustomerId(null);
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete customer');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-cream">
        <Loader2 className="w-12 h-12 text-terracotta animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-display font-bold text-ink">CRM & Customer Directory</h1>
          <p className="text-gray-500 mt-1">Manage relationships and track customer growth</p>
        </div>
        <button
          onClick={() => {
            setSelectedCustomerId(null);
            setFormData({ firstName: '', lastName: '', email: '', mobile: '', countryCode: '+66', notes: '', status: 'active', lineUserId: '' });
            setShowAddModal(true);
          }}
          className="bg-ink text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-black transition-all"
        >
          <Plus size={20} /> Add New Customer
        </button>
      </header>

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all"
              />
            </div>
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
              {(['all', 'loyalty', 'new'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-terracotta text-white' : 'text-gray-400 hover:text-ink'}`}
                >
                  {f === 'all' ? 'All Customers' : f === 'loyalty' ? 'Loyalty Members' : 'New Leads'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] uppercase font-bold tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Contact</th>
                <th className="px-6 py-4 text-left">Last Visit</th>
                <th className="px-6 py-4 text-right">Spend</th>
                <th className="px-6 py-4 text-center">Loyalty</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.map((customer) => {
                const isInactive = customer.status === 'inactive' || (customer.status as string) === 'deleted';
                return (
                  <tr
                    key={customer.id}
                    onClick={() => openEditModal(customer)}
                    className={`group hover:bg-cream/30 transition-colors cursor-pointer ${isInactive ? 'opacity-50' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${customer.loyaltyEnabled ? 'bg-terracotta/10 text-terracotta border border-terracotta/20' : 'bg-gray-100 text-gray-400'}`}>
                          {customer.firstName[0]}{customer.lastName?.[0] ?? ''}
                        </div>
                        <div>
                          <div className="font-bold text-ink flex items-center gap-2">
                            {customer.firstName} {customer.lastName}
                            {customer.loyaltyEnabled && <Star size={13} className="text-terracotta" fill="currentColor" />}
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono">ID: {customer.id?.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {customer.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Mail size={12} className="text-gray-400" /> {customer.email}
                          </div>
                        )}
                        {customer.mobile && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone size={12} className="text-gray-400" /> {customer.mobile}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar size={12} className="text-gray-400" />
                        {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'No visits recorded'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-bold text-sm text-terracotta">฿{(customer.totalSpend ?? 0).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {customer.loyaltyEnabled ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                              <CheckCircle2 size={10} /> Member
                            </span>
                            <span className="text-xs font-bold text-ink font-mono">฿{(customer.balance ?? 0).toLocaleString()}</span>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEnroll(customer); }}
                            disabled={enrollingId === customer.id}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {enrollingId === customer.id ? <Loader2 size={10} className="animate-spin" /> : <UserPlus size={10} />} Enroll
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(customer); }}
                          className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-ink transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(customer); }}
                          className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <Users size={32} />
                    </div>
                    <p className="text-gray-400 italic">No customers found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => !isSubmitting && setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-ink">
                      {selectedCustomerId ? 'Update Customer' : 'New Customer'}
                    </h2>
                    <p className="text-gray-500 mt-1">
                      {selectedCustomerId ? 'Edit customer profile' : 'Add to the CRM directory'}
                    </p>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">First Name *</label>
                      <input
                        required type="text" value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        placeholder="John"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Last Name</label>
                      <input
                        type="text" value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        placeholder="Doe"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="email" value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        className="w-full pl-14 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Mobile</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.countryCode}
                        onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                        className="w-24 px-2 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-mono text-sm"
                      >
                        <option value="+66">🇹🇭 +66</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+61">🇦🇺 +61</option>
                        <option value="+49">🇩🇪 +49</option>
                        <option value="+33">🇫🇷 +33</option>
                        <option value="+81">🇯🇵 +81</option>
                        <option value="+82">🇰🇷 +82</option>
                        <option value="+86">🇨🇳 +86</option>
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+65">🇸🇬 +65</option>
                        <option value="+60">🇲🇾 +60</option>
                        <option value="+852">🇭🇰 +852</option>
                        <option value="+7">🇷🇺 +7</option>
                        <option value="+971">🇦🇪 +971</option>
                        <option value="+34">🇪🇸 +34</option>
                        <option value="+39">🇮🇹 +39</option>
                        <option value="+55">🇧🇷 +55</option>
                      </select>
                      <div className="relative flex-1">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                          type="tel" value={formData.mobile}
                          onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                          placeholder="812 345 6789"
                          className="w-full pl-12 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium appearance-none"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Loyalty</label>
                      {(() => {
                        const customer = customers.find(c => c.id === selectedCustomerId);
                        return customer?.loyaltyEnabled ? (
                          <div className="w-full px-5 py-4 rounded-2xl bg-green-50 border border-green-100 text-green-700 font-bold flex items-center gap-2">
                            <CheckCircle2 size={18} /> Enrolled · ฿{(customer.balance ?? 0).toLocaleString()}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { const c = customers.find(x => x.id === selectedCustomerId); if (c) handleEnroll(c); }}
                            disabled={!!enrollingId}
                            className="w-full px-5 py-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 font-bold flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors disabled:opacity-50"
                          >
                            {enrollingId ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                            {selectedCustomerId ? 'Enroll Now' : 'Enroll after saving'}
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Notes</label>
                    <div className="relative">
                      <FileText className="absolute left-5 top-5 text-gray-400" size={18} />
                      <textarea
                        rows={3} value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Allergies, preferences, regulars on weekends..."
                        className="w-full pl-14 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">LINE User ID</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">LINE</span>
                      <input
                        type="text" value={formData.lineUserId}
                        onChange={(e) => setFormData({ ...formData, lineUserId: e.target.value })}
                        placeholder="Uxxxxxxxx..."
                        className="w-full pl-16 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none font-medium font-mono text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 px-1">Enables wallet notifications via LINE.</p>
                  </div>

                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={() => { const c = customers.find(x => x.id === selectedCustomerId); if (c) generateActivationLink(c); }}
                      className="w-full py-3 rounded-2xl font-bold border-2 border-green-500 text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                    >
                      🔗 Generate LINE Activation Link
                    </button>
                  )}

                  <div className="pt-4 flex gap-4">
                    {selectedCustomerId && (
                      <button
                        type="button"
                        onClick={() => { const c = customers.find(x => x.id === selectedCustomerId); if (c) handleDelete(c); }}
                        className="px-6 py-4 rounded-2xl font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="flex-1 px-6 py-4 rounded-2xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] px-6 py-4 rounded-2xl font-bold bg-terracotta text-white shadow-lg shadow-terracotta/20 hover:bg-terracotta/90 transition-all flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (selectedCustomerId ? 'Update Profile' : 'Save Customer')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
