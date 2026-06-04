import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CRMCustomer, SystemLog } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { sendVerificationCode } from '../services/twilioSMS';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  Calendar, 
  DollarSign, 
  Star,
  Edit2,
  Trash2,
  UserPlus,
  Loader2,
  FileText,
  Filter,
  CheckCircle2,
  X,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export default function CRMDirectory() {
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [loyaltyMembers, setLoyaltyMembers] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'loyalty' | 'new'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingOtpId, setSendingOtpId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    countryCode: '+66',
    notes: '',
    status: 'active' as 'active' | 'inactive',
    lineUserId: ''
  });

  const adminEmail = auth.currentUser?.email || 'unknown';
  const adminUid = auth.currentUser?.uid || 'unknown';

  useEffect(() => {
    // Listen to CRM customers
    const q = query(collection(db, 'crm_customers'), orderBy('createdAt', 'desc'));
    const unsubscribeCRM = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CRMCustomer[];
      setCustomers(data);
      setIsLoading(false);
    }, (err) => {
      handleFirestoreError(err, 'list', 'crm_customers');
    });

    // Listen to Loyalty customers to sync status
    const unsubscribeLoyalty = onSnapshot(collection(db, 'loyalty_customers'), (snapshot) => {
      const members: Record<string, boolean> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.mobile) {
          const digits = data.mobile.replace(/\D/g, '');
          const last9 = digits.slice(-9); // last 9 digits — works regardless of +66 / 0 prefix
          members[data.mobile] = true;  // raw
          members[digits] = true;       // digits only
          members[last9] = true;        // last 9 — the universal key
        }
      });
      setLoyaltyMembers(members);
    });

    return () => {
      unsubscribeCRM();
      unsubscribeLoyalty();
    };
  }, []);

  const filteredCustomers = useMemo(() => {
    let result = customers;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.firstName.toLowerCase().includes(lowerQuery) || 
        c.lastName.toLowerCase().includes(lowerQuery) || 
        c.email.toLowerCase().includes(lowerQuery) || 
        c.mobile.includes(searchQuery)
      );
    }

    if (filter === 'loyalty') {
      result = result.filter(c => loyaltyMembers[c.mobile]);
    } else if (filter === 'new') {
      // "New Leads" - maybe created in the last 7 days? 
      // For now, let's say anyone without loyalty and less than 100 total spend
      result = result.filter(c => !loyaltyMembers[c.mobile] && c.totalSpend < 100);
    }

    return result;
  }, [customers, searchQuery, filter, loyaltyMembers]);

  const logCRMAction = async (action: string, details: string) => {
    await logActivity(action, details, 'crm');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedCustomerId) {
        // Update — exclude lineUserId from crm_customers, it lives in loyalty_customers
        const { lineUserId, countryCode, mobile, ...crmFields } = formData;
        const fullMobile = mobile ? `${countryCode}${mobile.replace(/^0/, '')}` : '';
        const customerRef = doc(db, 'crm_customers', selectedCustomerId);
        await updateDoc(customerRef, {
          ...crmFields,
          mobile: fullMobile || mobile,
          updatedAt: new Date().toISOString()
        });

        // Sync lineUserId to loyalty_customers
        if (lineUserId !== undefined) {
          try {
            const loyaltyQ = query(collection(db, 'loyalty_customers'), where('mobile', '==', formData.mobile), limit(1));
            const loyaltySnap = await getDocs(loyaltyQ);
            if (!loyaltySnap.empty) {
              await updateDoc(doc(db, 'loyalty_customers', loyaltySnap.docs[0].id), {
                lineUserId: lineUserId,
                updatedAt: new Date().toISOString()
              });
            }
          } catch (loyaltyErr) {
            console.error('Failed to sync LINE ID to loyalty:', loyaltyErr);
          }
        }
        await logCRMAction('Customer Updated', `Updated customer: ${formData.firstName} ${formData.lastName} (${formData.email})`);
        toast.success('Customer updated successfully');
      } else {
        // Create
        const newCustomer = {
          ...formData,
          totalSpend: 0,
          uid: adminUid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'crm_customers'), newCustomer);

        // Generate LINE activation token and store it
        const activationToken = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        await addDoc(collection(db, 'activation_tokens'), {
          token: activationToken,
          crmCustomerId: docRef.id,
          loyaltyCustomerId: null,
          firstName: formData.firstName,
          lastName: formData.lastName,
          mobile: formData.mobile,
          used: false,
          createdAt: new Date().toISOString()
        });
        const activationLink = `https://cajunlifecafe.com/activate/${activationToken}`;
        navigator.clipboard.writeText(activationLink).catch(() => {});

        await logCRMAction('Customer Added', `Added new customer: ${formData.firstName} ${formData.lastName} (${formData.email})`);
        toast.success(`Customer added! Link copied: ${activationLink}`, { duration: 8000 });
      }
      
      setShowAddModal(false);
      setSelectedCustomerId(null);
      setFormData({ firstName: '', lastName: '', email: '', mobile: '', countryCode: '+66', notes: '', status: 'active', lineUserId: '' });
    } catch (err) {
      console.error('Error saving customer:', err);
      toast.error('Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: CRMCustomer) => {
    if (!customer.id) return;
    if (!window.confirm(`Are you sure you want to delete ${customer.firstName} ${customer.lastName}? This action cannot be undone.`)) return;

    try {
      await updateDoc(doc(db, 'crm_customers', customer.id), {
        status: 'deleted', // Soft delete or actual delete
        updatedAt: new Date().toISOString()
      });
      // Or actual delete: await deleteDoc(doc(db, 'crm_customers', customer.id));
      await logCRMAction('Customer Deleted', `Deleted customer: ${customer.firstName} ${customer.lastName} (${customer.id})`);
      toast.success('Customer deleted');
    } catch (err) {
      console.error('Error deleting customer:', err);
      toast.error('Failed to delete customer');
    }
  };

  // Normalise mobile to digits only for comparison
  const normaliseMobile = (mobile: string) => mobile.replace(/\D/g, '');

  const handleManualLoyaltyEnroll = async (customer: CRMCustomer) => {
    try {
      // Check if already exists — try both raw and digits-only match
      const customerDigits = normaliseMobile(customer.mobile);
      const allLoyalty = await getDocs(collection(db, 'loyalty_customers'));
      const alreadyEnrolled = allLoyalty.docs.some(doc => {
        const m = doc.data().mobile || '';
        return m === customer.mobile || normaliseMobile(m) === customerDigits;
      });
      if (alreadyEnrolled) {
        toast.error('Customer already in loyalty program');
        return;
      }

      await addDoc(collection(db, 'loyalty_customers'), {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        mobile: customer.mobile,
        balance: 50, // Starting bonus?
        tier: 'bronze',
        isVerified: true,
        uid: adminUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await logCRMAction('Manual Loyalty Enrollment', `Manually enrolled ${customer.firstName} ${customer.lastName} into loyalty program`);
      toast.success('Customer enrolled in loyalty program');
    } catch (err) {
      console.error('Loyalty enrollment error:', err);
      toast.error('Failed to enroll customer');
    }
  };

  const generateActivationLink = async (customer: CRMCustomer) => {
    try {
      const activationToken = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      // Find linked loyalty customer
      const loyaltyQ = query(collection(db, 'loyalty_customers'), where('mobile', '==', customer.mobile), limit(1));
      const loyaltySnap = await getDocs(loyaltyQ);
      const loyaltyCustomerId = loyaltySnap.empty ? null : loyaltySnap.docs[0].id;

      await addDoc(collection(db, 'activation_tokens'), {
        token: activationToken,
        crmCustomerId: customer.id || null,
        loyaltyCustomerId,
        firstName: customer.firstName,
        lastName: customer.lastName,
        mobile: customer.mobile,
        used: false,
        createdAt: new Date().toISOString()
      });
      const activationLink = `https://cajunlifecafe.com/activate/${activationToken}`;
      await navigator.clipboard.writeText(activationLink);
      toast.success('Activation link copied to clipboard!', { duration: 5000 });
    } catch (err) {
      console.error('Failed to generate activation link:', err);
      toast.error('Failed to generate link');
    }
  };

  const openEditModal = async (customer: CRMCustomer) => {
    setSelectedCustomerId(customer.id || null);
    // Fetch lineUserId from loyalty_customers (source of truth)
    let lineUserId = '';
    try {
      const loyaltyQ = query(collection(db, 'loyalty_customers'), where('mobile', '==', customer.mobile), limit(1));
      const loyaltySnap = await getDocs(loyaltyQ);
      if (!loyaltySnap.empty) {
        lineUserId = loyaltySnap.docs[0].data().lineUserId || '';
      }
    } catch (err) {
      console.error('Failed to fetch lineUserId:', err);
    }
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      mobile: customer.mobile,
      notes: customer.notes || '',
      status: customer.status || 'active',
      lineUserId
    });
    setShowAddModal(true);
  };

  const inviteToLoyalty = async (customer: CRMCustomer) => {
    // This would typically trigger an SMS or email
    // For now, let's just log it and show a success message
    await logCRMAction('Loyalty Invitation', `Invited ${customer.firstName} ${customer.lastName} to loyalty program`);
    toast.success(`Invitation sent to ${customer.mobile}`);
  };

  const handleSendOtp = async (customer: CRMCustomer) => {
    if (!customer.id) return;
    setSendingOtpId(customer.id);
    
    // Defensive: log to console to verify execution
    console.log(`Initiating OTP send for: ${customer.mobile}`);
    
    try {
      const response = await sendVerificationCode(customer.mobile);
      console.log("OTP API Response:", response);
      
      // Use the specific format requested by user
      toast.success(`OTP sent to ${customer.mobile}`, {
        description: "The verification code should arrive shortly."
      });
      
      await logCRMAction('OTP Sent', `Verification code sent to ${customer.firstName} ${customer.lastName} (${customer.mobile})`);
    } catch (err) {
      console.error('Failed to send OTP:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send verification code';
      toast.error(errorMessage, {
        duration: 5000
      });
    } finally {
      setSendingOtpId(null);
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
                placeholder="Search customers by name, email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all"
              />
            </div>
            
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
              <button 
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-terracotta text-white' : 'text-gray-400 hover:text-ink'}`}
              >
                All Customers
              </button>
              <button 
                onClick={() => setFilter('loyalty')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'loyalty' ? 'bg-terracotta text-white' : 'text-gray-400 hover:text-ink'}`}
              >
                Loyalty Members
              </button>
              <button 
                onClick={() => setFilter('new')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'new' ? 'bg-terracotta text-white' : 'text-gray-400 hover:text-ink'}`}
              >
                New Leads
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 text-[10px] uppercase font-bold tracking-widest text-gray-400 border-b border-gray-100">
                <th className="px-6 py-4 text-left">Customer</th>
                <th className="px-6 py-4 text-left">Contact Information</th>
                <th className="px-6 py-4 text-left">Visit History</th>
                <th className="px-6 py-4 text-right">Spend</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.map((customer) => {
                const mobileDigits = customer.mobile?.replace(/\D/g, '') || '';
                const isLoyalty = loyaltyMembers[customer.mobile] || loyaltyMembers[mobileDigits] || loyaltyMembers[mobileDigits.slice(-9)];
                const isInactive = customer.status === 'inactive';
                return (
                  <tr 
                    key={customer.id} 
                    onClick={() => openEditModal(customer)}
                    className={`group hover:bg-cream/30 transition-colors cursor-pointer ${isInactive ? 'opacity-60' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${isLoyalty ? 'bg-terracotta/10 text-terracotta border border-terracotta/20' : 'bg-gray-100 text-gray-400'}`}>
                          {customer.firstName[0]}{customer.lastName[0]}
                        </div>
                        <div>
                          <div className={`font-bold flex items-center gap-2 ${isInactive ? 'text-gray-400 line-through' : 'text-ink'}`}>
                            {customer.firstName} {customer.lastName}
                            {isLoyalty && (
                              <div className="text-terracotta" title="Cajun Wallet Member">
                                <Star size={14} fill="currentColor" />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono">ID: {customer.id?.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Mail size={12} className="text-gray-400" /> {customer.email}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone size={12} className="text-gray-400" /> {customer.mobile}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar size={12} className="text-gray-400" />
                        {customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'No visits recorded'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold text-sm ${isInactive ? 'text-gray-300' : 'text-terracotta'}`}>฿{customer.totalSpend.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        {isInactive ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                            Inactive
                          </span>
                        ) : isLoyalty ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            <CheckCircle2 size={10} /> Member
                          </span>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManualLoyaltyEnroll(customer);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors"
                          >
                            <UserPlus size={10} /> Enroll
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 transition-opacity">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendOtp(customer);
                          }}
                          disabled={sendingOtpId === customer.id}
                          className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-terracotta transition-colors disabled:opacity-50" 
                          title="Send Verification Code"
                        >
                          {sendingOtpId === customer.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(customer);
                          }}
                          className="p-2 hover:bg-white rounded-lg text-gray-400 hover:text-ink transition-colors" 
                          title="Edit Customer"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(customer);
                          }}
                          className="p-2 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500 transition-colors" 
                          title="Delete record"
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
                    <p className="text-gray-400 italic">No customers found matching your criteria</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => !isSubmitting && setShowAddModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-ink">
                      {selectedCustomerId ? 'Update Customer Profile' : 'Register New Customer'}
                    </h2>
                    <p className="text-gray-500 mt-1">
                      {selectedCustomerId ? 'Modify existing customer details' : 'Fill in the details for the manual directory entry'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">First Name</label>
                      <input 
                        required
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        placeholder="John"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Last Name <span className="normal-case font-normal text-gray-300">(optional)</span></label>
                      <input 
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        placeholder="Doe"
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Email Address <span className="normal-case font-normal text-gray-300">(optional)</span></label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          placeholder="john.doe@example.com"
                          className="w-full pl-14 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Mobile Phone <span className="normal-case font-normal text-gray-300">(optional)</span></label>
                      <div className="flex gap-2">
                        <select
                          value={formData.countryCode}
                          onChange={(e) => setFormData({...formData, countryCode: e.target.value})}
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
                          <option value="+966">🇸🇦 +966</option>
                          <option value="+31">🇳🇱 +31</option>
                          <option value="+46">🇸🇪 +46</option>
                          <option value="+47">🇳🇴 +47</option>
                          <option value="+45">🇩🇰 +45</option>
                          <option value="+55">🇧🇷 +55</option>
                          <option value="+41">🇨🇭 +41</option>
                          <option value="+34">🇪🇸 +34</option>
                          <option value="+39">🇮🇹 +39</option>
                        </select>
                        <div className="relative flex-1">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                          <input 
                            type="tel"
                            value={formData.mobile}
                            onChange={(e) => setFormData({...formData, mobile: e.target.value})}
                            placeholder="812 345 6789"
                            className="w-full pl-12 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Account Status</label>
                      <select 
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value as 'active' | 'inactive'})}
                        className="w-full px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium appearance-none"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive / Deactivated</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Loyalty Scheme</label>
                      {(loyaltyMembers[formData.mobile] || loyaltyMembers[formData.mobile?.replace(/\D/g, '')]) ? (
                        <div className="w-full px-5 py-4 rounded-2xl bg-green-50 border border-green-100 text-green-700 font-bold flex items-center gap-2">
                          <CheckCircle2 size={18} /> Enrolled Member
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => {
                            const customer = customers.find(c => c.id === selectedCustomerId);
                            if (customer) handleManualLoyaltyEnroll(customer);
                          }}
                          className="w-full px-5 py-4 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 font-bold flex items-center justify-center gap-3 hover:bg-amber-100 transition-colors"
                        >
                          <UserPlus size={18} /> Enroll Now
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Internal Notes</label>
                    <div className="relative">
                      <FileText className="absolute left-5 top-5 text-gray-400" size={18} />
                      <textarea 
                        rows={3}
                        value={formData.notes}
                        onChange={(e) => setFormData({...formData, notes: e.target.value})}
                        placeholder="e.g. Shellfish allergy, regulars on weekends..."
                        className="w-full pl-14 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest px-1">LINE User ID</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">LINE</span>
                      <input
                        type="text"
                        value={formData.lineUserId}
                        onChange={(e) => setFormData({...formData, lineUserId: e.target.value})}
                        placeholder="Paste LINE User ID (e.g. Uxxxxxxxx...)"
                        className="w-full pl-16 pr-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none transition-all font-medium font-mono text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 px-1">Find in LINE OA Manager → Chats → customer profile. Enables wallet notifications via LINE.</p>
                  </div>

                  {selectedCustomerId && (
                    <button
                      type="button"
                      onClick={() => {
                        const cust = customers.find(c => c.id === selectedCustomerId);
                        if (cust) generateActivationLink(cust);
                      }}
                      className="w-full py-3 rounded-2xl font-bold border-2 border-green-500 text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                    >
                      🔗 Generate LINE Activation Link
                    </button>
                  )}

                  <div className="pt-4 flex gap-4">
                    {selectedCustomerId && (
                      <button 
                        type="button"
                        onClick={() => {
                          const customer = customers.find(c => c.id === selectedCustomerId);
                          if (customer) handleDelete(customer);
                        }}
                        className="px-6 py-4 rounded-2xl font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-all flex items-center gap-2"
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
                      {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (selectedCustomerId ? 'Update Profile' : 'Save Customer Profile')}
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
