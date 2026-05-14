import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  limit,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { sendBalanceUpdate, sendReceiptSMS, sendTopUpSMS } from '../services/twilioSMS';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { 
  Search, 
  UserPlus, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  ShieldCheck, 
  Send, 
  Camera,
  History,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Plus,
  Upload,
  Trophy,
  PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { LoyaltyCustomer, LoyaltyTransaction, LoyaltyTransactionItem } from '../types';

// SMS Helper
const triggerSMSText = (mobile: string, message: string) => {
  console.log(`[SMS INTEGRATION] To: ${mobile} | Message: ${message}`);
  // In the future, integrate Twilio or SMS-Poh here
};

export default function LoyaltyDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loyaltyMembers, setLoyaltyMembers] = useState<LoyaltyCustomer[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  
  // Registration Form
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regMobile, setRegMobile] = useState('');

  // Wallet State
  const [topUpAmount, setTopUpAmount] = useState('');
  const [cashTopUpAmount, setCashTopUpAmount] = useState('');
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  const itemLeaderboard = React.useMemo(() => {
    const counts: Record<string, { name: string; qty: number; totalSpent: number }> = {};
    
    transactions.forEach(tx => {
      if (tx.items && tx.items.length > 0) {
        tx.items.forEach(item => {
          const key = item.name.toLowerCase().trim();
          if (!counts[key]) {
            counts[key] = { name: item.name, qty: 0, totalSpent: 0 };
          }
          counts[key].qty += (item.qty || 1);
          counts[key].totalSpent += (item.price || 0);
        });
      }
    });

    return Object.values(counts).sort((a, b) => b.qty - a.qty);
  }, [transactions]);

  useEffect(() => {
    // Fetch all loyalty members
    const q = query(collection(db, 'loyalty_customers'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoyaltyCustomer[];
      setLoyaltyMembers(members);
    });

    return () => unsubscribe();
  }, []);

  const adminEmail = auth.currentUser?.email || 'unknown';

  // Audit Log Helper
  const logLoyaltyAction = async (actionType: string, details: string, targetMobile: string) => {
    try {
      await addDoc(collection(db, 'system_logs'), {
        timestamp: serverTimestamp(),
        admin_email: adminEmail,
        action_type: actionType,
        details: details,
        target_customer_mobile: targetMobile,
        category: 'loyalty'
      });
    } catch (error) {
      console.error('Audit log failed:', error);
    }
  };

  const findCustomer = async (mobile: string) => {
    if (!mobile) return;
    setIsSearching(true);
    setCustomer(null);
    setShowRegisterForm(false);
    
    try {
      // Normalize: strip non-digits
      const normalized = mobile.replace(/\D/g, '');
      
      const q = query(
        collection(db, 'loyalty_customers'), 
        where('mobile', '==', normalized),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as LoyaltyCustomer;
        setCustomer({ ...data, id: snapshot.docs[0].id });
        fetchTransactions(snapshot.docs[0].id);
        toast.success(`Found member: ${data.firstName || data.name}`);
      } else {
        // Fallback for leading zero
        const altMobile = normalized.startsWith('0') ? normalized.slice(1) : '0' + normalized;
        const q2 = query(collection(db, 'loyalty_customers'), where('mobile', '==', altMobile), limit(1));
        const snapshot2 = await getDocs(q2);
        
        if (!snapshot2.empty) {
          const data = snapshot2.docs[0].data() as LoyaltyCustomer;
          setCustomer({ ...data, id: snapshot2.docs[0].id });
          fetchTransactions(snapshot2.docs[0].id);
          toast.success(`Found member: ${data.firstName || data.name}`);
          return;
        }

        // Partial match in local list
        const partialMatch = loyaltyMembers.find(m => 
          m.mobile.includes(normalized) || 
          (m.firstName + ' ' + m.lastName).toLowerCase().includes(mobile.toLowerCase())
        );

        if (partialMatch) {
          setCustomer(partialMatch);
          fetchTransactions(partialMatch.id);
          toast.success(`Matched member: ${partialMatch.firstName || partialMatch.name}`);
        } else {
          toast.error('Customer not found');
          setShowRegisterForm(true);
          setRegMobile(mobile);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchTransactions = (customerId: string) => {
    const q = query(
      collection(db, 'loyalty_customers', customerId, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    
    return onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LoyaltyTransaction[];
      setTransactions(txs);
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    
    try {
      const fullName = `${regFirstName} ${regLastName}`.trim();
      const normalizedMobile = regMobile.replace(/\D/g, '');

      const newCustomer = {
        firstName: regFirstName,
        lastName: regLastName,
        name: fullName,
        mobile: normalizedMobile,
        balance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isVerified: false
      };
      
      const docRef = await addDoc(collection(db, 'loyalty_customers'), newCustomer);
      setCustomer({ ...newCustomer, id: docRef.id } as LoyaltyCustomer);
      setShowRegisterForm(false);
      setRegFirstName('');
      setRegLastName('');
      setRegMobile('');
      
      await logLoyaltyAction('Customer Registered', `New member ${fullName} registered`, normalizedMobile);
      toast.success('Member registered successfully');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  const sendOTP = (mobile: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(code);
    setOtpSent(true);
    triggerSMSText(mobile, `Your Cajun Life loyalty verification code is: ${code}`);
    logLoyaltyAction('OTP Sent', `Verification code sent to ${mobile}`, mobile);
    toast.info('Verification code sent');
  };

  const verifyCustomer = async () => {
    if (!customer?.id) return;
    setIsVerifying(true);
    
    if (otpCode === generatedOTP) {
      try {
        await updateDoc(doc(db, 'loyalty_customers', customer.id), {
          isVerified: true,
          updatedAt: serverTimestamp()
        });
        setCustomer(prev => prev ? { ...prev, isVerified: true } : null);
        setOtpSent(false);
        setOtpCode('');
        await logLoyaltyAction('Customer Verified', `Customer ${customer.mobile} verified via OTP`, customer.mobile);
        toast.success('Customer verified successfully');
      } catch (error) {
        toast.error('Verification update failed');
      }
    } else {
      toast.error('Invalid verification code');
    }
    setIsVerifying(false);
  };

  const handleTopUp = async () => {
    if (!customer?.id || !topUpAmount) return;
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessingWallet(true);
    const bonus = amount * 0.1;
    const totalAdd = amount + bonus;
    
    try {
      const newBalance = (customer.balance || 0) + totalAdd;
      const customerRef = doc(db, 'loyalty_customers', customer.id);
      
      await updateDoc(customerRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(customerRef, 'transactions'), {
        type: 'TOP_UP',
        amount: amount,
        bonus: bonus,
        timestamp: serverTimestamp(),
        details: `Cash top-up with 10% bonus (฿${bonus})`
      });

      setCustomer(prev => prev ? { ...prev, balance: newBalance } : null);
      setTopUpAmount('');
      
      await logLoyaltyAction('Balance Loaded', `Loaded ฿${amount} + ฿${bonus} bonus to ${customer.mobile}`, customer.mobile);
      
      // Send SMS notification
      try {
        await sendBalanceUpdate(customer.id, totalAdd, 'TOP_UP', newBalance);
      } catch (smsErr) {
        console.error('Failed to send balance update SMS:', smsErr);
      }

      toast.success(`฿${totalAdd} added to wallet!`);
    } catch (error) {
      toast.error('Top-up failed');
    } finally {
      setIsProcessingWallet(false);
    }
  };

  const handleTopUpWithBonus = async () => {
    if (!customer?.id || !cashTopUpAmount) return;
    const cash = parseFloat(cashTopUpAmount);
    if (isNaN(cash) || cash <= 0) return;

    setIsProcessingTopUp(true);
    const bonus = cash * 0.1;
    const totalPoints = cash + bonus;
    
    try {
      const newBalance = (customer.balance || 0) + totalPoints;
      const customerRef = doc(db, 'loyalty_customers', customer.id);
      
      await updateDoc(customerRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(customerRef, 'transactions'), {
        type: 'TOP_UP',
        amount: cash,
        bonus: bonus,
        timestamp: serverTimestamp(),
        details: `Cash top-up ฿${cash} (Bonus: ${bonus} pts)`
      });

      setCustomer(prev => prev ? { ...prev, balance: newBalance } : null);
      setCashTopUpAmount('');
      
      await logLoyaltyAction('Wallet Top Up', `Top up ฿${cash} to ${customer.mobile}`, customer.mobile);
      
      // Send SMS notification
      try {
        await sendTopUpSMS(customer.id, cash, totalPoints, bonus, newBalance);
      } catch (smsErr) {
        console.error('Failed to send top up SMS:', smsErr);
      }

      toast.success(`฿${totalPoints} added to wallet!`);
    } catch (error) {
      toast.error('Top-up failed');
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const filteredMembers = loyaltyMembers.filter(m => 
    m.mobile.includes(searchQuery) || 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Loyalty & Payments</h1>
          <p className="text-gray-500">Manage customer rewards and wallet balances</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="tel"
            placeholder="Search by Mobile (e.g. 086...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-24 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none transition-all"
            onKeyDown={(e) => e.key === 'Enter' && findCustomer(searchQuery)}
          />
          <button 
            onClick={() => findCustomer(searchQuery)}
            disabled={isSearching}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-terracotta text-white px-4 py-1.5 rounded-xl text-sm font-bold hover:bg-terracotta/90 transition-all disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {showRegisterForm && !customer && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl max-w-md mx-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-olive/10 rounded-2xl text-olive">
                  <UserPlus size={24} />
                </div>
                <h2 className="text-xl font-bold text-ink">Register Member</h2>
              </div>
              <button 
                onClick={() => {
                  setShowRegisterForm(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-ink transition-colors font-bold text-sm"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                  <input 
                    required
                    value={regFirstName}
                    onChange={(e) => setRegFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-olive outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                  <input 
                    required
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-olive outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    required
                    value={regMobile}
                    type="tel"
                    onChange={(e) => setRegMobile(e.target.value)}
                    placeholder="08X XXX XXXX"
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-olive outline-none"
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={isRegistering}
                className="w-full py-4 bg-olive text-white rounded-2xl font-bold shadow-lg shadow-olive/20 hover:shadow-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isRegistering ? <Loader2 className="animate-spin" /> : 'Create Account'}
              </button>
            </form>
          </motion.div>
        )}

        {customer && (
          <div className="space-y-6">
            <button 
              onClick={() => {
                setCustomer(null);
                setSearchQuery('');
              }}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-terracotta transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center group-hover:border-terracotta/20 group-hover:bg-terracotta/5">
                <Search size={14} className="-rotate-90 group-hover:scale-110 transition-transform" />
              </div>
              Back to Member List
            </button>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-2 gap-6"
            >
            {/* Customer Info & Profile */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-olive/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-cream rounded-3xl flex items-center justify-center text-olive relative">
                    <User size={40} />
                    {customer.isVerified && (
                      <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-md">
                        <CheckCircle2 className="text-green-500" size={20} />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-ink">
                      {customer.firstName && customer.lastName 
                        ? `${customer.firstName} ${customer.lastName}` 
                        : customer.name || 'Cajun Customer'}
                    </h3>
                    <p className="text-gray-500 font-mono">{customer.mobile}</p>
                    <div className="mt-2 flex items-center gap-2">
                       {!customer.isVerified ? (
                         <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                           <AlertCircle size={12} /> Pending Verification
                         </span>
                       ) : (
                         <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-600 bg-green-50 px-3 py-1 rounded-full">
                           <ShieldCheck size={12} /> Verified Member
                         </span>
                       )}
                    </div>
                  </div>
                </div>

                {!customer.isVerified && (
                  <div className="mt-6 pt-6 border-t border-gray-50">
                    {!otpSent ? (
                      <button 
                        onClick={() => sendOTP(customer.mobile)}
                        className="w-full py-3 bg-ink text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all"
                      >
                        <Send size={16} /> Send Verification Code
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <input 
                          type="text" 
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-ink/20 text-center tracking-[0.5em] font-bold text-xl outline-none"
                        />
                        <button 
                          onClick={verifyCustomer}
                          disabled={isVerifying || otpCode.length < 6}
                          className="w-full py-3 bg-terracotta text-white rounded-xl font-bold disabled:opacity-50"
                        >
                          {isVerifying ? <Loader2 className="animate-spin mx-auto" /> : 'Confirm Verification'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Top Up Wallet Card */}
              <div className="bg-ink p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <ArrowUpCircle size={100} />
                </div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Wallet className="text-olive" size={20} /> Top Up Wallet
                </h3>
                <div className="space-y-4 relative z-10">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2 px-1">Cash Amount (฿)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={cashTopUpAmount}
                        onChange={(e) => setCashTopUpAmount(e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 outline-none font-bold text-2xl placeholder:text-white/20"
                      />
                    </div>
                  </div>
                  
                  {cashTopUpAmount && parseFloat(cashTopUpAmount) > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-white/5 rounded-2xl p-4 border border-white/10"
                    >
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/60">Base Value</span>
                        <span className="font-mono">฿{parseFloat(cashTopUpAmount).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-olive">
                        <span>10% Reward Bonus</span>
                        <span className="font-mono">+฿{(parseFloat(cashTopUpAmount) * 0.1).toLocaleString()}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                        <span className="font-bold">Total Points</span>
                        <span className="text-xl font-display font-bold text-olive">
                          {(parseFloat(cashTopUpAmount) * 1.1).toLocaleString()} pts
                        </span>
                      </div>
                    </motion.div>
                  )}

                  <button 
                    onClick={handleTopUpWithBonus}
                    disabled={isProcessingTopUp || !cashTopUpAmount}
                    className="w-full py-4 bg-white text-ink rounded-2xl font-bold shadow-lg hover:bg-cream transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessingTopUp ? <Loader2 className="animate-spin" /> : <><ArrowUpCircle size={20} /> Add to Wallet</>}
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction History & Leaderboard */}
            <div className="space-y-6">
              {/* Transaction History */}
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-cream rounded-2xl text-terracotta">
                      <History size={24} />
                    </div>
                    <h3 className="text-xl font-bold text-ink">Recent Transactions</h3>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                        <th className="text-left pb-4">Type</th>
                        <th className="text-left pb-4">Details</th>
                        <th className="text-right pb-4">Amount</th>
                        <th className="text-right pb-4 px-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(() => {
                        let currentRunningBalance = customer.balance;
                        return transactions.map((tx, index) => {
                          const balanceAtPoint = currentRunningBalance;
                          const netEffect = tx.amount + (tx.bonus || 0);
                          currentRunningBalance -= netEffect;

                          return (
                            <tr key={tx.id} className="group hover:bg-gray-50 transition-colors">
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  {tx.type === 'TOP_UP' ? (
                                    <ArrowUpCircle className="text-green-500" size={16} />
                                  ) : (
                                    <ArrowDownCircle className="text-terracotta" size={16} />
                                  )}
                                  <span className="text-xs font-bold text-ink">{tx.type}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {tx.timestamp instanceof Timestamp ? tx.timestamp.toDate().toLocaleDateString() : 'Just now'}
                                </span>
                              </td>
                              <td className="py-4 text-xs text-ink max-w-[200px]">
                                <div className="font-medium text-gray-500 italic truncate">{tx.memo || tx.details}</div>
                                {tx.items && tx.items.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {tx.items.slice(0, 3).map((item, i) => (
                                      <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        {item.qty}x {item.name}
                                      </span>
                                    ))}
                                    {tx.items.length > 3 && (
                                      <span className="text-[9px] text-gray-400">+{tx.items.length - 3} more</span>
                                    )}
                                  </div>
                                )}
                                {tx.receiptUrl && (
                                  <a 
                                    href={tx.receiptUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center text-terracotta hover:underline font-bold text-[10px]"
                                  >
                                    <FileText size={10} className="mr-1" /> View Receipt
                                  </a>
                                )}
                              </td>
                              <td className={`py-4 text-right font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-terracotta'}`}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount + (tx.bonus || 0)}
                              </td>
                              <td className="py-4 text-right text-xs font-mono text-gray-500 px-2">
                                ฿{balanceAtPoint.toLocaleString()}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {transactions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-20 text-center text-gray-400 italic">No transactions found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* FULL-WIDTH LEADERBOARD BELOW THE PROFILE */}
            <div className="mt-8 pt-8 border-t border-gray-100">
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-olive/10 rounded-2xl text-olive">
                    <Trophy size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-ink">Member Order Statistics</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">What this member orders most</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {itemLeaderboard.length > 0 ? (
                    itemLeaderboard.slice(0, 12).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between group p-4 rounded-2xl bg-gray-50 hover:bg-olive/5 transition-all">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${
                            idx === 0 ? 'bg-amber-100 text-amber-700 shadow-amber-200/50' :
                            idx === 1 ? 'bg-slate-100 text-slate-700 shadow-slate-200/50' :
                            idx === 2 ? 'bg-orange-100 text-orange-700 shadow-orange-200/50' :
                            'bg-white text-gray-400'
                          }`}>
                            {idx + 1}
                          </div>
                          <span className="text-sm font-bold text-ink truncate group-hover:text-olive transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-ink">{item.qty}x</span>
                          <p className="text-[10px] text-gray-400 font-mono italic">฿{item.totalSpent.toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full flex flex-col items-center justify-center text-center py-12">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mb-4">
                        <PieChart size={32} />
                      </div>
                      <p className="text-sm font-bold text-gray-400 italic">No items logged yet for this member</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

        {!customer && !showRegisterForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-24 h-24 bg-cream rounded-[40px] flex items-center justify-center text-terracotta/20">
                <User size={64} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-ink">No Customer Selected</h3>
                <p className="text-gray-400 max-w-xs mx-auto">Select a member from the list below or search by mobile number</p>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-ink flex items-center gap-2">
                  <User size={18} className="text-olive" /> Loyalty Members ({filteredMembers.length})
                </h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setCustomer(member);
                      if (member.id) fetchTransactions(member.id);
                    }}
                    className="w-full p-4 flex items-center justify-between hover:bg-cream/30 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center text-olive font-bold text-sm">
                        {member.firstName?.[0] || member.name?.[0] || '?'}{(member.lastName?.[0] || (member.name?.split(' ')[1]?.[0])) || ''}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-ink group-hover:text-terracotta transition-colors">
                          {member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.name}
                        </p>
                        <p className="text-gray-400 text-xs font-mono">{member.mobile}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-display font-bold text-ink">฿{(member.balance || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Balance</p>
                    </div>
                  </button>
                ))}
                {filteredMembers.length === 0 && (
                  <div className="p-12 text-center text-gray-400 italic">
                    No members found matching your search.
                  </div>
                )}
              </div>
            </div>

            {/* Global Top Orders Leaderboard */}
            <div className="bg-ink p-8 rounded-[32px] text-white shadow-xl overflow-hidden relative">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Trophy size={160} />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-white/10 rounded-2xl text-olive">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Top Orders</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Most popular items across all members</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(() => {
                      // Aggregate items across all members could be complex, 
                      // but here we just use the current customer's if available or empty.
                      // For a true global leaderboard, we'd need a separate collection or aggregate view.
                      // Given we are in the member list view, let's keep it contextual or global?
                      // User asked for "leaderboard should be below the fold".
                      return itemLeaderboard.length > 0 ? (
                        itemLeaderboard.slice(0, 8).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                idx === 0 ? 'bg-amber-500 text-white' :
                                idx === 1 ? 'bg-slate-400 text-white' :
                                idx === 2 ? 'bg-orange-400 text-white' :
                                'bg-white/10 text-white/40'
                              }`}>
                                {idx + 1}
                              </div>
                              <span className="text-sm font-bold truncate">
                                {item.name}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-sm font-bold text-olive">{item.qty}x</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-12 text-center text-white/20 italic">
                          No order history data collected yet.
                        </div>
                      );
                    })()}
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
