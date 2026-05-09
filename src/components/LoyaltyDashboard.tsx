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
import { db, auth } from '../firebase';
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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface LoyaltyCustomer {
  id?: string;
  name: string;
  mobile: string;
  balance: number;
  createdAt: any;
  updatedAt: any;
  isVerified: boolean;
}

interface Transaction {
  id: string;
  type: 'TOP_UP' | 'REDEEM' | 'BONUS';
  amount: number;
  timestamp: any;
  details: string;
}

// SMS Helper
const triggerSMSText = (mobile: string, message: string) => {
  console.log(`[SMS INTEGRATION] To: ${mobile} | Message: ${message}`);
  // In the future, integrate Twilio or SMS-Poh here
};

export default function LoyaltyDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomer] = useState<LoyaltyCustomer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  
  // Registration Form
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');

  // Wallet State
  const [topUpAmount, setTopUpAmount] = useState('');
  const [isProcessingWallet, setIsProcessingWallet] = useState(false);

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
      const q = query(
        collection(db, 'loyalty_customers'), 
        where('mobile', '==', mobile),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data() as LoyaltyCustomer;
        setCustomer({ ...data, id: snapshot.docs[0].id });
        fetchTransactions(snapshot.docs[0].id);
      } else {
        setShowRegisterForm(true);
        setRegMobile(mobile);
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
      limit(5)
    );
    
    return onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    
    try {
      const newCustomer = {
        name: regName,
        mobile: regMobile,
        balance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isVerified: false
      };
      
      const docRef = await addDoc(collection(db, 'loyalty_customers'), newCustomer);
      setCustomer({ ...newCustomer, id: docRef.id });
      setShowRegisterForm(false);
      setRegName('');
      setRegMobile('');
      
      await logLoyaltyAction('Customer Registered', `New customer ${regName} registered`, regMobile);
      toast.success('Customer registered successfully');
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
      toast.success(`฿${totalAdd} added to wallet!`);
    } catch (error) {
      toast.error('Top-up failed');
    } finally {
      setIsProcessingWallet(false);
    }
  };

  const handleRedeem = async () => {
    if (!customer?.id) return;
    // Mock Scan Receipt - just deduct a fixed amount or prompt for amount for now
    const amountStr = prompt('Enter receipt amount for deduction:');
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;
    if (amount > customer.balance) {
      toast.error('Insufficient balance');
      return;
    }

    setIsProcessingWallet(true);
    try {
      const newBalance = customer.balance - amount;
      const customerRef = doc(db, 'loyalty_customers', customer.id);
      
      await updateDoc(customerRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      });

      await addDoc(collection(customerRef, 'transactions'), {
        type: 'REDEEM',
        amount: -amount,
        timestamp: serverTimestamp(),
        details: `Redeemed via receipt scan`
      });

      setCustomer(prev => prev ? { ...prev, balance: newBalance } : null);
      await logLoyaltyAction('Balance Redeemed', `Redeemed ฿${amount} from ${customer.mobile}`, customer.mobile);
      toast.success(`฿${amount} deducted from wallet`);
    } catch (error) {
      toast.error('Redeem failed');
    } finally {
      setIsProcessingWallet(false);
    }
  };

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
        {showRegisterForm && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-xl max-w-md mx-auto"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-olive/10 rounded-2xl text-olive">
                <UserPlus size={24} />
              </div>
              <h2 className="text-xl font-bold text-ink">Register New Customer</h2>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Full Name</label>
                <input 
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 focus:ring-2 focus:ring-olive outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Mobile Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    required
                    value={regMobile}
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
                {isRegistering ? <Loader2 className="animate-spin" /> : 'Register Customer'}
              </button>
            </form>
          </motion.div>
        )}

        {customer && (
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
                    <h3 className="text-2xl font-bold text-ink">{customer.name}</h3>
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

              {/* Wallet Operations */}
              <div className="bg-ink p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute bottom-0 right-0 p-4 opacity-10">
                  <Wallet size={120} />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <p className="text-white/60 text-sm font-medium mb-1">Available Balance</p>
                    <h4 className="text-5xl font-display font-bold">฿{(customer.balance || 0).toLocaleString()}</h4>
                  </div>
                  
                  <div className="mt-10 space-y-4">
                    <div className="relative">
                      <input 
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="Top Up Amount"
                        className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 pl-4 pr-32 outline-none font-bold text-xl placeholder:text-white/30"
                      />
                      <button 
                        onClick={handleTopUp}
                        disabled={isProcessingWallet || !topUpAmount}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-ink px-6 py-2 rounded-xl font-bold hover:bg-cream transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {isProcessingWallet ? <Loader2 className="animate-spin" size={18} /> : (
                          <><ArrowUpCircle size={18} /> Top Up</>
                        )}
                      </button>
                    </div>
                    {topUpAmount && (
                      <p className="text-xs text-white/60 px-2 flex justify-between">
                        <span>+10% Bonus: ฿{(parseFloat(topUpAmount) * 0.1).toFixed(0)}</span>
                        <span className="font-bold text-white">Total Wallet Credit: ฿{(parseFloat(topUpAmount) * 1.1).toFixed(0)}</span>
                      </p>
                    )}
                    
                    <button 
                      onClick={handleRedeem}
                      disabled={isProcessingWallet || (customer.balance || 0) <= 0}
                      className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-terracotta/90 transition-all border border-white/10 disabled:opacity-50"
                    >
                      <Camera size={20} /> Scan Receipt to Redeem
                    </button>
                  </div>
                </div>
              </div>
            </div>

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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => (
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
                        <td className="py-4 text-xs text-gray-500 italic max-w-[150px] truncate">
                          {tx.details}
                        </td>
                        <td className={`py-4 text-right font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-terracotta'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-20 text-center text-gray-400 italic">No transactions found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {!customer && !showRegisterForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-center space-y-4"
          >
            <div className="w-24 h-24 bg-cream rounded-[40px] flex items-center justify-center text-terracotta/20">
              <User size={64} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">No Customer Selected</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Enter a mobile number to start managing rewards or register a new member</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
