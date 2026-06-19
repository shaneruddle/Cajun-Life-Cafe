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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  Search, 
  Wallet, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Camera,
  History,
  User,
  Loader2,
  FileText,
  Trophy,
  PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { CRMCustomer, LoyaltyTransaction, LoyaltyTransactionItem } from '../types';
import { logActivity } from '../utils/logger';

// LINE Push Helper
const sendLinePush = async (lineUserId: string, message: string) => {
  try {
    await fetch('/api/line-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, message })
    });
  } catch (err) {
    console.error('[LINE PUSH] Failed:', err);
  }
};

export default function LoyaltyDashboard({ isAdmin = false }: { isAdmin?: boolean }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customer, setCustomer] = useState<CRMCustomer | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [loyaltyMembers, setLoyaltyMembers] = useState<CRMCustomer[]>([]);

  // Bonus percentage — per-customer, default 10%, admins can set 10–30%
  const [bonusPct, setBonusPct] = useState(10);

  // Wallet state
  const [cashTopUpAmount, setCashTopUpAmount] = useState('');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);

  // Scan & Pay state
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [scannedAmount, setScannedAmount] = useState<number | null>(null);
  const [scannedImageFile, setScannedImageFile] = useState<File | null>(null);
  const [isProcessingRedemption, setIsProcessingRedemption] = useState(false);
  const [showScanConfirm, setShowScanConfirm] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  const adminEmail = auth.currentUser?.email || 'unknown';

  const itemLeaderboard = React.useMemo(() => {
    const counts: Record<string, { name: string; qty: number; totalSpent: number }> = {};
    transactions.forEach(tx => {
      tx.items?.forEach(item => {
        const key = item.name.toLowerCase().trim();
        if (!counts[key]) counts[key] = { name: item.name, qty: 0, totalSpent: 0 };
        counts[key].qty += (item.qty || 1);
        counts[key].totalSpent += (item.price || 0);
      });
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty);
  }, [transactions]);

  // Load all loyalty-enrolled customers from crm_customers
  useEffect(() => {
    const q = query(
      collection(db, 'crm_customers'),
      where('loyaltyEnabled', '==', true)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const members = (snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as CRMCustomer[])
        .sort((a, b) => {
          const aTime = a.updatedAt ?? a.createdAt ?? '';
          const bTime = b.updatedAt ?? b.createdAt ?? '';
          return bTime.localeCompare(aTime);
        });
      setLoyaltyMembers(members);
      // Keep selected customer in sync with live data
      setCustomer(prev => {
        if (!prev?.id) return prev;
        const updated = members.find(m => m.id === prev.id);
        return updated ?? prev;
      });
    });
    return () => unsub();
  }, []);

  const fetchTransactions = (customerId: string) => {
    const q = query(
      collection(db, 'crm_customers', customerId, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as LoyaltyTransaction[]);
    });
  };

  const findCustomer = async (input: string) => {
    if (!input.trim()) return;
    setIsSearching(true);
    setCustomer(null);
    try {
      const normalized = input.replace(/\D/g, '');
      // Search within already-loaded loyalty members first
      const match = loyaltyMembers.find(m =>
        (m.mobile ?? '').includes(normalized) ||
        `${m.firstName} ${m.lastName}`.toLowerCase().includes(input.toLowerCase())
      );
      if (match) {
        setCustomer(match);
        fetchTransactions(match.id!);
        setBonusPct(match.bonusPct ?? 10);
        toast.success(`Found: ${match.firstName} ${match.lastName}`);
      } else {
        toast.error('No loyalty member found');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleTopUpWithBonus = async () => {
    if (!customer?.id || !cashTopUpAmount) return;
    const cash = parseFloat(cashTopUpAmount);
    if (isNaN(cash) || cash <= 0) return;
    setIsProcessingTopUp(true);

    const bonus = Math.round(cash * (bonusPct / 100) * 100) / 100;
    const totalPoints = cash + bonus;
    const prevBalance = customer.balance ?? 0;
    const newBalance = prevBalance + totalPoints;

    try {
      await updateDoc(doc(db, 'crm_customers', customer.id), {
        balance: newBalance,
        bonusPct,
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'crm_customers', customer.id, 'transactions'), {
        type: 'TOP_UP',
        amount: cash,
        bonus,
        timestamp: serverTimestamp(),
        details: `Cash top-up ฿${cash} + ${bonusPct}% bonus ฿${bonus}`,
      });
      await logActivity('Wallet Top Up', `${customer.firstName} ${customer.lastName} (${customer.mobile}) | Cash: ฿${cash} | Bonus: ฿${bonus} | Total: ฿${totalPoints} | Before: ฿${prevBalance} | After: ฿${newBalance} | Staff: ${adminEmail}`, 'loyalty');

      if (customer.lineUserId) {
        await sendLinePush(customer.lineUserId, `Cajun Life Cafe\n\n💰 Wallet topped up: +฿${totalPoints.toLocaleString()} (incl. ฿${bonus.toLocaleString()} ${bonusPct}% bonus)\nNew balance: ฿${newBalance.toLocaleString()}`);
      }

      setCashTopUpAmount('');
      toast.success(`฿${totalPoints.toLocaleString()} added to wallet!`);
    } catch (err) {
      console.error('Top-up error:', err);
      toast.error('Top-up failed');
    } finally {
      setIsProcessingTopUp(false);
    }
  };

  const handleScanReceipt = async (file: File) => {
    setIsScanningReceipt(true);
    setScannedAmount(null);
    setShowScanConfirm(false);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        setScannedImageFile(file);
        const resp = await fetch('/api/ocr-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });
        const data = await resp.json();
        if (data.success && data.data?.total) {
          setScannedAmount(parseFloat(data.data.total));
          setShowScanConfirm(true);
        } else {
          toast.error('Could not read receipt total. Please try again.');
        }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to scan receipt.');
    } finally {
      setIsScanningReceipt(false);
    }
  };

  const handleConfirmRedemption = async () => {
    if (!customer?.id || scannedAmount === null || !scannedImageFile) return;
    const amount = scannedAmount;
    const prevBalance = customer.balance ?? 0;
    const newBalance = prevBalance - amount;

    if (newBalance < 0) {
      toast.error(`Insufficient balance. Available: ฿${prevBalance.toLocaleString()}`);
      return;
    }

    setIsProcessingRedemption(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const storageRef = ref(storage, `receipts/${dateStr}/${customer.mobile ?? customer.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, scannedImageFile);
      const receiptUrl = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'crm_customers', customer.id), {
        balance: newBalance,
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'crm_customers', customer.id, 'transactions'), {
        type: 'REDEEM',
        amount,
        memo: `Receipt payment ฿${amount.toLocaleString()}`,
        receiptUrl,
        balanceAfter: newBalance,
        timestamp: serverTimestamp(),
        processedBy: adminEmail,
      });
      await logActivity('Receipt Redemption', `${customer.firstName} ${customer.lastName} (${customer.mobile}) | Deducted: ฿${amount} | Before: ฿${prevBalance} | After: ฿${newBalance} | Receipt: ${receiptUrl} | Staff: ${adminEmail}`, 'loyalty');

      if (customer.lineUserId) {
        await sendLinePush(customer.lineUserId, `Cajun Life Cafe\n\n💰 Payment received: ฿${amount.toLocaleString()}\nRemaining balance: ฿${newBalance.toLocaleString()}\n\nThank you! 🙏`);
      }

      setScannedAmount(null);
      setScannedImageFile(null);
      setShowScanConfirm(false);
      toast.success(`฿${amount.toLocaleString()} deducted. New balance: ฿${newBalance.toLocaleString()}`);
    } catch (err) {
      console.error('Redemption error:', err);
      toast.error('Failed to process redemption.');
    } finally {
      setIsProcessingRedemption(false);
    }
  };

  const filteredMembers = loyaltyMembers.filter(m =>
    (m.mobile ?? '').includes(searchQuery) ||
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
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
            type="text"
            placeholder="Search by name or mobile..."
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
        {customer ? (
          <div className="space-y-6">
            <button
              onClick={() => { setCustomer(null); setSearchQuery(''); setTransactions([]); }}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-terracotta transition-colors"
            >
              ← Back to Member List
            </button>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                {/* Profile card */}
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-cream rounded-3xl flex items-center justify-center text-olive">
                      <User size={40} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-ink">{customer.firstName} {customer.lastName}</h3>
                      {customer.mobile && <p className="text-gray-500 font-mono">{customer.mobile}</p>}
                      {customer.email && <p className="text-gray-400 text-xs">{customer.email}</p>}
                      <div className="mt-3">
                        <span className="text-3xl font-display font-bold text-terracotta">
                          ฿{(customer.balance ?? 0).toLocaleString()}
                        </span>
                        <span className="text-gray-400 text-sm ml-2">wallet balance</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin bonus rate control */}
                {isAdmin && (
                  <div className="bg-white border border-gray-100 p-5 rounded-[24px] shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Bonus Rate (Admin)</span>
                      <span className="text-lg font-display font-bold text-terracotta">{bonusPct}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={30}
                      step={1}
                      value={bonusPct}
                      onChange={(e) => setBonusPct(parseInt(e.target.value))}
                      className="w-full accent-terracotta"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-1">
                      <span>10%</span><span>Default</span><span>30%</span>
                    </div>
                  </div>
                )}

                {/* Top Up card */}
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
                      <input
                        type="number"
                        value={cashTopUpAmount}
                        onChange={(e) => setCashTopUpAmount(e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-4 outline-none font-bold text-2xl placeholder:text-white/20"
                      />
                    </div>
                    {cashTopUpAmount && parseFloat(cashTopUpAmount) > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="bg-white/5 rounded-2xl p-4 border border-white/10"
                      >
                        <div className="flex justify-between text-sm">
                          <span className="text-white/60">Base</span>
                          <span className="font-mono">฿{parseFloat(cashTopUpAmount).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm text-olive">
                          <span>{bonusPct}% Bonus</span>
                          <span className="font-mono">+฿{(parseFloat(cashTopUpAmount) * bonusPct / 100).toLocaleString()}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between">
                          <span className="font-bold">Total Added</span>
                          <span className="text-xl font-display font-bold text-olive">
                            ฿{(parseFloat(cashTopUpAmount) * (1 + bonusPct / 100)).toLocaleString()}
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

                {/* Scan & Pay card */}
                <div className="bg-terracotta p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Camera size={100} />
                  </div>
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Camera size={20} /> Scan & Pay
                  </h3>
                  <div className="space-y-4 relative z-10">
                    <p className="text-white/60 text-sm">Scan receipt to deduct from wallet.</p>
                    {!showScanConfirm ? (
                      <label className="block w-full cursor-pointer">
                        <input
                          type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanReceipt(f); e.target.value = ''; }}
                        />
                        <div className="w-full py-4 bg-white text-terracotta rounded-2xl font-bold shadow-lg hover:bg-cream transition-all flex justify-center items-center gap-2">
                          {isScanningReceipt ? <><Loader2 className="animate-spin" size={20} /> Reading receipt...</> : <><Camera size={20} /> Scan Receipt</>}
                        </div>
                      </label>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                          <p className="text-white/60 text-xs uppercase tracking-widest font-bold mb-1">Receipt Total</p>
                          <p className="text-3xl font-display font-bold">฿{scannedAmount?.toLocaleString()}</p>
                          {(customer.balance ?? 0) - (scannedAmount ?? 0) < 0 ? (
                            <p className="text-red-300 text-xs mt-2 font-bold">⚠️ Insufficient balance (฿{(customer.balance ?? 0).toLocaleString()} available)</p>
                          ) : (
                            <p className="text-white/60 text-xs mt-2">Balance after: ฿{((customer.balance ?? 0) - (scannedAmount ?? 0)).toLocaleString()}</p>
                          )}
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => { setShowScanConfirm(false); setScannedAmount(null); }}
                            className="flex-1 py-3 bg-white/10 text-white rounded-2xl font-bold border border-white/20 hover:bg-white/20 transition-all"
                          >
                            Rescan
                          </button>
                          <button
                            onClick={handleConfirmRedemption}
                            disabled={isProcessingRedemption || (customer.balance ?? 0) - (scannedAmount ?? 0) < 0}
                            className="flex-1 py-3 bg-white text-terracotta rounded-2xl font-bold hover:bg-cream transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                          >
                            {isProcessingRedemption ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Payment'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column — transactions */}
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-cream rounded-2xl text-terracotta">
                    <History size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-ink">Recent Transactions</h3>
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
                        let runningBalance = customer.balance ?? 0;
                        return transactions.map((tx) => {
                          const balanceAtPoint = runningBalance;
                          const net = tx.amount + (tx.bonus || 0);
                          if (tx.type === 'TOP_UP') runningBalance -= net;
                          else runningBalance += net;
                          return (
                            <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-4">
                                <div className="flex items-center gap-2">
                                  {tx.type === 'TOP_UP'
                                    ? <ArrowUpCircle className="text-green-500" size={16} />
                                    : <ArrowDownCircle className="text-terracotta" size={16} />}
                                  <span className="text-xs font-bold text-ink">{tx.type}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {tx.timestamp instanceof Timestamp ? tx.timestamp.toDate().toLocaleDateString() : 'Just now'}
                                </span>
                              </td>
                              <td className="py-4 text-xs text-gray-500 italic max-w-[180px] truncate">
                                {tx.memo || tx.details}
                                {tx.receiptUrl && (
                                  <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer"
                                    className="ml-1 inline-flex items-center text-terracotta hover:underline font-bold text-[10px]">
                                    <FileText size={10} className="mr-1" /> Receipt
                                  </a>
                                )}
                              </td>
                              <td className={`py-4 text-right font-bold text-sm ${tx.type === 'TOP_UP' ? 'text-green-600' : 'text-terracotta'}`}>
                                {tx.type === 'TOP_UP' ? '+' : '-'}฿{(tx.amount + (tx.bonus || 0)).toLocaleString()}
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
                          <td colSpan={4} className="py-20 text-center text-gray-400 italic">No transactions yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Order leaderboard */}
            {itemLeaderboard.length > 0 && (
              <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-3 bg-olive/10 rounded-2xl text-olive"><Trophy size={24} /></div>
                  <div>
                    <h3 className="text-xl font-bold text-ink">Member Order Statistics</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Most ordered items</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {itemLeaderboard.slice(0, 12).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-olive/5 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-100 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-400'
                        }`}>{idx + 1}</div>
                        <span className="text-sm font-bold text-ink truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-ink">{item.qty}x</span>
                        <p className="text-[10px] text-gray-400 font-mono">฿{item.totalSpent.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="font-bold text-ink flex items-center gap-2">
                  <User size={18} className="text-olive" /> Loyalty Members ({filteredMembers.length})
                </h3>
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-50">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => { setCustomer(member); fetchTransactions(member.id!); setBonusPct(member.bonusPct ?? 10); }}
                    className="w-full p-4 flex items-center justify-between hover:bg-cream/30 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center text-olive font-bold text-sm">
                        {member.firstName[0]}{member.lastName?.[0] ?? ''}
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-ink group-hover:text-terracotta transition-colors">
                            {member.firstName} {member.lastName}
                          </p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-olive/10 text-olive">
                            +{member.bonusPct ?? 10}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-gray-400 text-xs font-mono">{member.mobile}</p>
                          {member.lineUserId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#06C75520', color: '#06C755' }}>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                              LINE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.630 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                              No LINE
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-display font-bold text-ink">฿{(member.balance ?? 0).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Balance</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
