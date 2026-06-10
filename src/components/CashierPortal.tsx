import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  doc, getDoc, setDoc, updateDoc, deleteDoc, limit, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { logActivity } from '../utils/logger';
import {
  LogIn, LogOut, Camera, Loader2, Search, User, UserPlus,
  Wallet, ArrowUpCircle, ArrowDownCircle, History, Star,
  Phone, Mail, FileText, X, Check, ChevronLeft,
  Receipt, ClipboardList, Plus, Trash2, Pencil, ChevronDown, Upload, MapPin, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { CRMCustomer, LoyaltyTransaction, LineItem } from '../types';
const DeliveryMap = React.lazy(() => import('./DeliveryMap'));

// ââ LINE push helper âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const sendLinePush = async (lineUserId: string, message: string) => {
  try {
    await fetch('/api/line-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineUserId, message }),
    });
  } catch (err) {
    console.error('[LINE PUSH] Failed:', err);
  }
};

// ââ Login ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
function LoginScreen({ onLogin }: { onLogin: (user: any) => void }) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  // ââ Sign-in state ââ
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ââ Sign-up state ââ
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suLoading, setSuLoading] = useState(false);
  const [suDone, setSuDone] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Enter your email and password'); return; }
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        toast.error('Account not set up. Contact your manager.');
        await signOut(auth); return;
      }
      const data = snap.data();
      if (!['cashier', 'manager', 'admin'].includes(data.role)) {
        toast.error('Your account is pending approval. Ask your manager to grant access.');
        await signOut(auth); return;
      }
      await setDoc(doc(db, 'users', cred.user.uid), { lastLogin: new Date().toISOString() }, { merge: true });
      await logActivity('Staff Sign In', `${data.displayName || suEmail || cred.user.email} signed in via email`, 'user');
      onLogin({ ...data, uid: cred.user.uid });
    } catch (err: any) {
      const code = err.code || '';
      if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(code)) {
        toast.error('Incorrect email or password');
      } else if (code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Try again later.');
      } else {
        toast.error('Login failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!email) { toast.error('Enter your email first'); return; }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Reset email sent â check your inbox');
      setShowReset(false);
    } catch {
      toast.error('Could not send reset email.');
    } finally {
      setResetting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const snap = await getDoc(doc(db, 'users', cred.user.uid));
      if (!snap.exists()) {
        toast.error('No staff account found for this Google account. Contact your manager.');
        await signOut(auth); return;
      }
      const data = snap.data();
      if (!['cashier', 'manager', 'admin'].includes(data.role)) {
        toast.error('Your account is pending approval. Ask your manager to grant access.');
        await signOut(auth); return;
      }
      await setDoc(doc(db, 'users', cred.user.uid), { lastLogin: new Date().toISOString() }, { merge: true });
      await logActivity('Staff Sign In', `${data.displayName || cred.user.email} signed in via Google`, 'user');
      onLogin({ ...data, uid: cred.user.uid });
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-in failed. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suName.trim()) { toast.error('Enter your name'); return; }
    if (!suEmail.trim()) { toast.error('Enter your email'); return; }
    if (suPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (suPassword !== suConfirm) { toast.error('Passwords do not match'); return; }
    setSuLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, suEmail.trim(), suPassword);
      // Don't await anything else â just mark done and sign out in background
      setSuDone(true);
      // Write doc and sign out in background without blocking UI
      setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: suEmail.trim(),
        displayName: suName.trim(),
        role: 'employee',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      }).catch(console.error);
      signOut(auth).catch(console.error);
    } catch (err: any) {
      const code = err.code || err.message || '';
      console.error('SIGNUP ERROR:', code, err);
      if (code === 'auth/email-already-in-use') {
        toast.error('That email is already registered. Try signing in.');
      } else if (code === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else if (code === 'auth/weak-password') {
        toast.error('Password must be at least 6 characters.');
      } else if (code === 'auth/operation-not-allowed') {
        toast.error('Sign-up disabled â contact admin.');
      } else {
        toast.error('Sign-up failed: ' + code);
      }
    } finally {
      setSuLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-terracotta to-terracotta/80 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-white/20 mb-4">
            <span className="text-white font-display font-bold text-4xl">C</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Cajun Life Cafe</h1>
          <p className="text-white/70 mt-1 text-sm">Staff Portal</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/20 rounded-2xl p-1 mb-4">
          <button
            type="button"
            onClick={() => setTab('signin')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'signin' ? 'bg-white text-terracotta shadow' : 'text-white/80 hover:text-white'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'signup' ? 'bg-white text-terracotta shadow' : 'text-white/80 hover:text-white'}`}
          >
            Sign Up
          </button>
        </div>

        {tab === 'signin' ? (
          <form onSubmit={handleLogin} className="bg-white rounded-3xl p-8 shadow-2xl space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email" autoComplete="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="you@email.com"
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="â¢â¢â¢â¢â¢â¢â¢â¢"
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg hover:bg-terracotta/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? <><Loader2 size={20} className="animate-spin" /> Signing inâ¦</> : <><LogIn size={20} /> Sign In</>}
            </button>
            <div className="relative flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 font-medium">or</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <button type="button" onClick={handleGoogleLogin} disabled={loading}
              className="w-full py-4 border-2 border-gray-200 text-gray-700 rounded-2xl font-bold text-base hover:bg-gray-50 transition-all disabled:opacity-60 flex items-center justify-center gap-3"
            >
              <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
              Continue with Google
            </button>
            <button type="button" onClick={() => setShowReset(!showReset)}
              className="w-full text-center text-sm text-gray-400 hover:text-terracotta transition-colors"
            >
              Forgot password?
            </button>
            {showReset && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm text-amber-700 mb-3">We'll send a reset link to the email above.</p>
                <button type="button" onClick={handleReset} disabled={resetting}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {resetting && <Loader2 size={16} className="animate-spin" />} Send Reset Email
                </button>
              </div>
            )}
          </form>
        ) : suDone ? (
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Account Created!</h2>
            <p className="text-gray-500 text-sm">Your account is pending approval. Ask your manager to grant you cashier access, then sign in.</p>
            <button
              type="button"
              onClick={() => { setSuDone(false); setTab('signin'); setEmail(suEmail); }}
              className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold hover:bg-terracotta/90 transition-all"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignUp} className="bg-white rounded-3xl p-8 shadow-2xl space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text" autoComplete="name" value={suName}
                onChange={e => setSuName(e.target.value)} placeholder="Your name"
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email" autoComplete="email" value={suEmail}
                onChange={e => setSuEmail(e.target.value)} placeholder="you@email.com"
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input
                type="password" autoComplete="new-password" value={suPassword}
                onChange={e => setSuPassword(e.target.value)} placeholder="Min. 6 characters"
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <input
                type="password" autoComplete="new-password" value={suConfirm}
                onChange={e => setSuConfirm(e.target.value)} placeholder="Repeat password"
                className="w-full border border-gray-200 rounded-2xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
            </div>
            <button type="submit" disabled={suLoading}
              className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg hover:bg-terracotta/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
            >
              {suLoading ? <><Loader2 size={20} className="animate-spin" /> Creating accountâ¦</> : 'Create Account'}
            </button>
            <p className="text-center text-xs text-gray-400">After signing up, your manager will grant you access.</p>
          </form>
        )}
      </div>
    </div>
  );
}


// ââ Register new customer form âââââââââââââââââââââââââââââââââââââââââââââââââ
function RegisterForm({
  onSaved,
  onCancel,
  staffEmail,
  staffUid,
  prefillName = '',
}: {
  onSaved: (customer: CRMCustomer) => void;
  onCancel: () => void;
  staffEmail: string;
  staffUid: string;
  prefillName?: string;
}) {
  const [firstName, setFirstName] = useState(prefillName.split(' ')[0] || '');
  const [lastName, setLastName] = useState(prefillName.split(' ').slice(1).join(' ') || '');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | undefined>(undefined);
  const [deliveryLng, setDeliveryLng] = useState<number | undefined>(undefined);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [enroll, setEnroll] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { toast.error('First name is required'); return; }
    setSaving(true);
    try {
      const fullMobile = mobile ? `+66${mobile.replace(/^0/, '')}` : '';
      const newCustomer: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        mobile: fullMobile || mobile,
        notes,
        address,
        deliveryLat: deliveryLat ?? null,
        deliveryLng: deliveryLng ?? null,
        deliveryNotes,
        totalSpend: 0,
        status: 'active',
        uid: staffUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (enroll) {
        newCustomer.loyaltyEnabled = true;
        newCustomer.balance = 0;
        newCustomer.isVerified = true;
      }
      const docRef = await addDoc(collection(db, 'crm_customers'), newCustomer);
      await logActivity('Customer Registered', `${firstName} ${lastName} registered by cashier ${staffEmail}${enroll ? ' â enrolled in loyalty' : ''}`, 'crm');
      toast.success(`${firstName} registered${enroll ? ' & enrolled!' : '!'}`);
      onSaved({ ...newCustomer, id: docRef.id });
    } catch (err) {
      console.error(err);
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button onClick={onCancel} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={22} />
        </button>
        <h2 className="font-bold text-lg text-ink">New Customer</h2>
      </div>

      <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 pb-32">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">First Name *</label>
            <input
              required value={firstName} onChange={e => setFirstName(e.target.value)}
              placeholder="John"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Last Name</label>
            <input
              value={lastName} onChange={e => setLastName(e.target.value)}
              placeholder="Doe"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mobile</label>
          <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-terracotta">
            <span className="px-4 py-3.5 text-gray-500 font-mono text-sm bg-gray-50 border-r border-gray-200">ð¹ð­ +66</span>
            <input
              type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
              placeholder="812 345 678"
              className="flex-1 px-4 py-3.5 text-base focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="optional"
            className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notes</label>
          <textarea
            rows={2} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Allergies, preferences, regulars..."
            className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Address</label>
          <textarea
            rows={2} value={address} onChange={e => setAddress(e.target.value)}
            placeholder="House number, street, area..."
            className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Delivery Location
          </label>
          <p className="text-xs text-gray-400 mb-2">Tap the map or drag the pin to mark drop-off point.</p>
          <React.Suspense fallback={<div style={{height:220,background:"#f3f4f6",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:13}}>Loading mapâ¦</div>}>
            <DeliveryMap
              lat={deliveryLat}
              lng={deliveryLng}
              onChange={(lat, lng) => { setDeliveryLat(lat); setDeliveryLng(lng); }}
            />
          </React.Suspense>
          {deliveryLat && (
            <p className="text-[10px] text-gray-400 font-mono mt-1">
              {deliveryLat.toFixed(6)}, {deliveryLng?.toFixed(6)}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Delivery Notes</label>
          <textarea
            rows={2} value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
            placeholder="Gate code, floor, landmark, instructions..."
            className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta resize-none"
          />
        </div>

        {/* Enroll toggle */}
        <button
          type="button"
          onClick={() => setEnroll(!enroll)}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
            enroll ? 'border-terracotta bg-terracotta/5' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <Star size={20} className={enroll ? 'text-terracotta' : 'text-gray-300'} fill={enroll ? 'currentColor' : 'none'} />
            <div className="text-left">
              <p className={`font-bold text-sm ${enroll ? 'text-terracotta' : 'text-gray-500'}`}>Enroll in Loyalty Program</p>
              <p className="text-xs text-gray-400">10% bonus on every top-up</p>
            </div>
          </div>
          <div className={`w-12 h-6 rounded-full transition-all relative ${enroll ? 'bg-terracotta' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${enroll ? 'left-7' : 'left-1'}`} />
          </div>
        </button>
      </form>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
        <button type="submit" form="" onClick={handleSave} disabled={saving}
          className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
        >
          {saving ? <><Loader2 size={20} className="animate-spin" /> Savingâ¦</> : <><UserPlus size={20} /> Save Customer</>}
        </button>
      </div>
    </div>
  );
}

// ââ Customer detail / wallet screen âââââââââââââââââââââââââââââââââââââââââââ
function CustomerWallet({
  customer,
  onBack,
  staffEmail,
}: {
  customer: CRMCustomer;
  onBack: () => void;
  staffEmail: string;
}) {
  const [liveCustomer, setLiveCustomer] = useState(customer);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [tab, setTab] = useState<'pay' | 'topup' | 'history'>('pay');

  // Top-up state
  const [topUpAmount, setTopUpAmount] = useState('');
  const [processingTopUp, setProcessingTopUp] = useState(false);

  // Scan & Pay state
  const [scanning, setScanning] = useState(false);
  const [scannedAmount, setScannedAmount] = useState<number | null>(null);
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [processingPay, setProcessingPay] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Live updates
  useEffect(() => {
    if (!customer.id) return;
    const unsub = onSnapshot(doc(db, 'crm_customers', customer.id), snap => {
      if (snap.exists()) setLiveCustomer({ id: snap.id, ...snap.data() } as CRMCustomer);
    });
    return unsub;
  }, [customer.id]);

  useEffect(() => {
    if (!customer.id) return;
    const q = query(
      collection(db, 'crm_customers', customer.id, 'transactions'),
      orderBy('timestamp', 'desc'), limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })) as LoyaltyTransaction[]);
    });
    return unsub;
  }, [customer.id]);

  const handleTopUp = async () => {
    const cash = parseFloat(topUpAmount);
    if (!cash || cash <= 0 || !liveCustomer.id) return;
    setProcessingTopUp(true);
    const bonus = Math.round(cash * 0.1 * 100) / 100;
    const total = cash + bonus;
    const prev = liveCustomer.balance ?? 0;
    const next = prev + total;
    try {
      await updateDoc(doc(db, 'crm_customers', liveCustomer.id), {
        balance: next, updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'crm_customers', liveCustomer.id, 'transactions'), {
        type: 'TOP_UP', amount: cash, bonus,
        timestamp: Timestamp.now(),
        details: `Cash top-up à¸¿${cash} + 10% bonus à¸¿${bonus}`,
      });
      await logActivity('Wallet Top Up', `${liveCustomer.firstName} ${liveCustomer.lastName} | Cash: à¸¿${cash} | Bonus: à¸¿${bonus} | New balance: à¸¿${next} | Staff: ${staffEmail}`, 'loyalty');
      if (liveCustomer.lineUserId) {
        await sendLinePush(liveCustomer.lineUserId, `Cajun Life Cafe\n\nð° Wallet topped up: +à¸¿${total.toLocaleString()} (incl. à¸¿${bonus.toLocaleString()} bonus)\nNew balance: à¸¿${next.toLocaleString()}`);
      }
      setTopUpAmount('');
      setTab('pay');
      toast.success(`à¸¿${total.toLocaleString()} added!`);
    } catch (err) {
      console.error(err); toast.error('Top-up failed');
    } finally {
      setProcessingTopUp(false);
    }
  };

  const handleScan = async (file: File) => {
    setScanning(true);
    setScannedAmount(null);
    setShowConfirm(false);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const resp = await fetch('/api/ocr-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await resp.json();
      if (data.success && data.data?.total) {
        setScannedAmount(parseFloat(data.data.total));
        setScannedFile(file);
        setShowConfirm(true);
      } else {
        toast.error('Could not read receipt total. Try again.');
      }
    } catch {
      toast.error('Scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirmPay = async () => {
    if (!liveCustomer.id || scannedAmount === null || !scannedFile) return;
    const amount = scannedAmount;
    const prev = liveCustomer.balance ?? 0;
    const next = prev - amount;
    if (next < 0) { toast.error(`Insufficient balance`); return; }
    setProcessingPay(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const storageRef = ref(storage, `receipts/${dateStr}/${liveCustomer.id}_${Date.now()}.jpg`);
      await uploadBytes(storageRef, scannedFile);
      const receiptUrl = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'crm_customers', liveCustomer.id), {
        balance: next, updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, 'crm_customers', liveCustomer.id, 'transactions'), {
        type: 'REDEEM', amount,
        memo: `Receipt payment à¸¿${amount.toLocaleString()}`,
        receiptUrl, balanceAfter: next,
        timestamp: Timestamp.now(),
        processedBy: staffEmail,
      });
      await logActivity('Receipt Redemption', `${liveCustomer.firstName} ${liveCustomer.lastName} | à¸¿${amount} deducted | Balance: à¸¿${prev} â à¸¿${next} | Staff: ${staffEmail}`, 'loyalty');
      if (liveCustomer.lineUserId) {
        await sendLinePush(liveCustomer.lineUserId, `Cajun Life Cafe\n\nð° Payment: à¸¿${amount.toLocaleString()}\nRemaining balance: à¸¿${next.toLocaleString()}\n\nThank you! ð`);
      }
      setScannedAmount(null);
      setScannedFile(null);
      setShowConfirm(false);
      toast.success(`Payment confirmed! Balance: à¸¿${next.toLocaleString()}`);
    } catch (err) {
      console.error(err); toast.error('Payment failed');
    } finally {
      setProcessingPay(false);
    }
  };

  const [activationLink, setActivationLink] = useState<string | null>(null);

  const generateActivationLink = async () => {
    if (!liveCustomer.id) return;
    try {
      // 1. Write token to Firestore
      const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
      await addDoc(collection(db, 'activation_tokens'), {
        token,
        crmCustomerId: liveCustomer.id,
        firstName: liveCustomer.firstName,
        lastName: liveCustomer.lastName,
        mobile: liveCustomer.mobile || '',
        used: false,
        createdAt: new Date().toISOString(),
      });
      const link = `https://cajunlifecafe.com/activate/${token}`;
      setActivationLink(link);

      // 2. Try clipboard â may fail on mobile, that's ok
      try {
        await navigator.clipboard.writeText(link);
        toast.success('Activation link copied to clipboard!', { duration: 6000 });
      } catch {
        // Clipboard not available (common on mobile) â show link on screen instead
      }
    } catch (err) {
      console.error('Activation token error:', err);
      toast.error('Failed to generate link â check Firestore rules');
    }
  };

  const balance = liveCustomer.balance ?? 0;
  const cash = parseFloat(topUpAmount) || 0;
  const bonus = Math.round(cash * 0.1 * 100) / 100;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-5 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-ink truncate">{liveCustomer.firstName} {liveCustomer.lastName}</h2>
            <p className="text-xs text-gray-400 font-mono">{liveCustomer.mobile}</p>
            {liveCustomer.lineUserId ? (
              <p className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-0.5">
                <span>â</span> LINE linked
              </p>
            ) : (
              <button
                onClick={generateActivationLink}
                className="text-[10px] text-amber-600 font-bold underline mt-0.5"
              >
                Link LINE â
              </button>
            )}
            {activationLink && !liveCustomer.lineUserId && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-[10px] text-amber-700 font-bold mb-1">Send this link to the customer:</p>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-mono text-amber-800 break-all flex-1">{activationLink}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(activationLink).then(() => toast.success('Copied!'))}
                    className="text-[10px] bg-amber-500 text-white px-2 py-1 rounded-lg font-bold shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-display font-bold text-terracotta">à¸¿{balance.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Balance</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {([
            { id: 'pay', label: 'ð· Scan & Pay' },
            { id: 'topup', label: 'ð° Top Up' },
            { id: 'history', label: 'ð History' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                tab === t.id ? 'bg-terracotta text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* ââ Scan & Pay ââ */}
        {tab === 'pay' && (
          <div className="space-y-4">
            {!showConfirm ? (
              <>
                <div className="bg-terracotta rounded-3xl p-8 text-white text-center space-y-6">
                  <p className="text-white/70 text-sm">Scan the POS receipt to deduct from wallet</p>
                  <button
                    onClick={() => cameraRef.current?.click()}
                    disabled={scanning}
                    className="w-full py-5 bg-white text-terracotta rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-lg hover:bg-cream transition-all disabled:opacity-60"
                  >
                    {scanning
                      ? <><Loader2 size={24} className="animate-spin" /> Reading receiptâ¦</>
                      : <><Camera size={24} /> Scan Receipt</>
                    }
                  </button>
                  <p className="text-white/50 text-xs">Current balance: à¸¿{balance.toLocaleString()}</p>
                </div>
                <input
                  ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f); e.target.value = ''; }}
                />
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-white border-2 border-gray-100 rounded-3xl p-6 space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Receipt Total</p>
                  <p className="text-5xl font-display font-bold text-ink">à¸¿{scannedAmount?.toLocaleString()}</p>
                  <div className="pt-4 border-t border-gray-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Current balance</span>
                      <span className="font-bold">à¸¿{balance.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">After payment</span>
                      <span className={`font-bold ${balance - (scannedAmount ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        à¸¿{(balance - (scannedAmount ?? 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {balance - (scannedAmount ?? 0) < 0 && (
                    <div className="bg-red-50 rounded-2xl p-3 text-red-600 text-sm font-bold text-center">
                      â ï¸ Insufficient balance
                    </div>
                  )}
                </div>
                <button
                  onClick={handleConfirmPay}
                  disabled={processingPay || balance - (scannedAmount ?? 0) < 0}
                  className="w-full py-5 bg-terracotta text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
                >
                  {processingPay ? <><Loader2 size={24} className="animate-spin" /> Processingâ¦</> : <><Check size={24} /> Confirm Payment</>}
                </button>
                <button
                  onClick={() => { setShowConfirm(false); setScannedAmount(null); setScannedFile(null); }}
                  className="w-full py-4 border-2 border-gray-200 text-gray-600 rounded-2xl font-bold"
                >
                  Rescan
                </button>
              </div>
            )}
          </div>
        )}

        {/* ââ Top Up ââ */}
        {tab === 'topup' && (
          <div className="space-y-4">
            <div className="bg-ink rounded-3xl p-6 text-white space-y-4">
              <p className="text-white/60 text-sm">Enter the cash amount received from the customer</p>
              <div>
                <label className="block text-[10px] uppercase font-bold text-white/40 tracking-widest mb-2">Cash Amount (à¸¿)</label>
                <input
                  type="number" inputMode="decimal" value={topUpAmount}
                  onChange={e => setTopUpAmount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-white/10 border border-white/20 rounded-2xl py-4 px-5 text-4xl font-bold placeholder:text-white/20 focus:outline-none focus:border-white/40"
                />
              </div>
              {cash > 0 && (
                <div className="bg-white/5 rounded-2xl p-4 space-y-2 border border-white/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Cash received</span>
                    <span className="font-mono">à¸¿{cash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-olive">
                    <span>10% bonus</span>
                    <span className="font-mono">+à¸¿{bonus.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="font-bold">Added to wallet</span>
                    <span className="font-bold text-olive text-lg">à¸¿{(cash + bonus).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleTopUp}
              disabled={processingTopUp || !cash || cash <= 0}
              className="w-full py-5 bg-ink text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg disabled:opacity-40"
            >
              {processingTopUp
                ? <><Loader2 size={24} className="animate-spin" /> Processingâ¦</>
                : <><ArrowUpCircle size={24} /> Add to Wallet</>
              }
            </button>
          </div>
        )}

        {/* ââ History ââ */}
        {tab === 'history' && (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <History size={40} className="mx-auto mb-3 opacity-30" />
                <p className="italic">No transactions yet</p>
              </div>
            ) : transactions.map(tx => (
              <div key={tx.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  tx.type === 'TOP_UP' ? 'bg-green-100 text-green-600' : 'bg-terracotta/10 text-terracotta'
                }`}>
                  {tx.type === 'TOP_UP' ? <ArrowUpCircle size={20} /> : <ArrowDownCircle size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">{tx.type === 'TOP_UP' ? 'Top Up' : 'Payment'}</p>
                  <p className="text-xs text-gray-400 truncate">{tx.memo || tx.details}</p>
                  <p className="text-[10px] text-gray-300">
                    {tx.timestamp instanceof Timestamp ? tx.timestamp.toDate().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold ${tx.type === 'TOP_UP' ? 'text-green-600' : 'text-terracotta'}`}>
                    {tx.type === 'TOP_UP' ? '+' : '-'}à¸¿{(tx.amount + (tx.bonus || 0)).toLocaleString()}
                  </p>
                  {tx.receiptUrl && (
                    <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-terracotta underline">Receipt</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ââ Loyalty tab â search + member list ââââââââââââââââââââââââââââââââââââââââ
function LoyaltyTab({ user }: { user: any }) {
  const [query_, setQuery_] = useState('');
  const [members, setMembers] = useState<CRMCustomer[]>([]);
  const [selected, setSelected] = useState<CRMCustomer | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'crm_customers'),
      where('loyaltyEnabled', '==', true)
    );
    return onSnapshot(q, snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CRMCustomer[]);
    }, (err) => {
      console.error('[LoyaltyTab] Firestore error:', err.code, err.message);
      toast.error(`Could not load members: ${err.code}`);
    });
  }, []);

  const filtered = members.filter(m =>
    `${m.firstName} ${m.lastName}`.toLowerCase().includes(query_.toLowerCase()) ||
    (m.mobile ?? '').includes(query_)
  );

  if (selected) {
    return (
      <CustomerWallet
        customer={selected}
        onBack={() => setSelected(null)}
        staffEmail={user.email}
      />
    );
  }

  if (showRegister) {
    return (
      <RegisterForm
        onSaved={(c) => { setShowRegister(false); if (c.loyaltyEnabled) setSelected(c); }}
        onCancel={() => setShowRegister(false)}
        staffEmail={user.email}
        staffUid={user.uid}
        prefillName={query_}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text" value={query_} onChange={e => setQuery_(e.target.value)}
            placeholder="Search by name or mobileâ¦"
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-terracotta text-base"
          />
        </div>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && query_ ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
              <User size={40} />
            </div>
            <div>
              <p className="font-bold text-ink">No member found for "{query_}"</p>
              <p className="text-sm text-gray-400 mt-1">Register them as a new customer?</p>
            </div>
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold shadow-lg"
            >
              <UserPlus size={18} /> Register New Customer
            </button>
          </div>
        ) : (
          <>
            {filtered.map(member => (
              <button
                key={member.id}
                onClick={() => setSelected(member)}
                className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-50 hover:bg-cream/40 transition-colors active:bg-cream"
              >
                <div className="w-12 h-12 bg-cream rounded-2xl flex items-center justify-center text-terracotta font-bold text-lg shrink-0">
                  {member.firstName[0]}{member.lastName?.[0] ?? ''}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-bold text-ink">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-gray-400 font-mono">{member.mobile}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-display font-bold text-ink">à¸¿{(member.balance ?? 0).toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest">Balance</p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && !query_ && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <Star size={40} className="mb-3 opacity-20" />
                <p className="italic">No loyalty members yet</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB â register new */}
      <div className="p-4 bg-white border-t border-gray-100">
        <button
          onClick={() => setShowRegister(true)}
          className="w-full py-4 bg-ink text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <UserPlus size={20} /> Register New Customer
        </button>
      </div>
    </div>
  );
}

// ââ CRM tab â full directory âââââââââââââââââââââââââââââââââââââââââââââââââââ
function CRMTab({ user }: { user: any }) {
  const [query_, setQuery_] = useState('');
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  const [selected, setSelected] = useState<CRMCustomer | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'crm_customers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as CRMCustomer[]);
    }, (err) => {
      console.error('[CRMTab] Firestore error:', err.code, err.message);
      toast.error(`Could not load customers: ${err.code}`);
    });
  }, []);

  const filtered = customers.filter(c =>
    (c.status as string) !== 'deleted' &&
    (`${c.firstName} ${c.lastName}`.toLowerCase().includes(query_.toLowerCase()) ||
    (c.mobile ?? '').includes(query_) ||
    (c.email ?? '').toLowerCase().includes(query_.toLowerCase()))
  );

  // Edit form state â must be declared before any conditional returns (Rules of Hooks)
  const [editData, setEditData] = useState<Partial<CRMCustomer>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      setEditData({
        mobile: selected.mobile || '',
        email: selected.email || '',
        notes: selected.notes || '',
        address: selected.address || '',
        deliveryLat: selected.deliveryLat,
        deliveryLng: selected.deliveryLng,
        deliveryNotes: selected.deliveryNotes || '',
      });
    }
  }, [selected?.id]);

  const handleEnroll = async (customer: CRMCustomer) => {
    if (!customer.id || customer.loyaltyEnabled) return;
    setEnrolling(true);
    try {
      await updateDoc(doc(db, 'crm_customers', customer.id), {
        loyaltyEnabled: true, balance: 0, isVerified: true,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('Loyalty Enrollment', `${customer.firstName} ${customer.lastName} enrolled by ${user.email}`, 'loyalty');
      toast.success(`${customer.firstName} enrolled in loyalty!`);
      setSelected(prev => prev?.id === customer.id ? { ...prev, loyaltyEnabled: true, balance: 0 } : prev);
    } catch { toast.error('Enrollment failed'); }
    finally { setEnrolling(false); }
  };

  if (showRegister) {
    return (
      <RegisterForm
        onSaved={(c) => { setShowRegister(false); setSelected(c); }}
        onCancel={() => setShowRegister(false)}
        staffEmail={user.email}
        staffUid={user.uid}
        prefillName={query_}
      />
    );
  }

  const handleSaveEdit = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'crm_customers', selected.id), {
        ...editData,
        deliveryLat: editData.deliveryLat ?? null,
        deliveryLng: editData.deliveryLng ?? null,
        updatedAt: new Date().toISOString(),
      });
      await logActivity('Customer Updated', `${selected.firstName} ${selected.lastName} updated by cashier ${user.email}`, 'crm');
      setSelected(prev => prev ? { ...prev, ...editData } : prev);
      toast.success('Customer updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <button onClick={() => setSelected(null)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg text-ink">{selected.firstName} {selected.lastName}</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Edit Profile</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-32">
          {/* Loyalty status â read only */}
          {selected.loyaltyEnabled ? (
            <div className="bg-terracotta/5 border border-terracotta/20 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="font-bold text-terracotta flex items-center gap-2 text-sm">
                  <Star size={14} fill="currentColor" /> Loyalty Member
                </p>
                <p className="text-xl font-display font-bold text-ink">à¸¿{(selected.balance ?? 0).toLocaleString()}</p>
              </div>
              <Wallet size={32} className="text-terracotta/20" />
            </div>
          ) : (
            <button
              onClick={() => handleEnroll(selected)}
              disabled={enrolling}
              className="w-full py-3 bg-amber-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {enrolling ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />}
              Enroll in Loyalty Program
            </button>
          )}

          {/* Editable fields */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mobile</label>
            <div className="flex items-center border border-gray-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-terracotta">
              <span className="px-4 py-3.5 text-gray-500 font-mono text-sm bg-gray-50 border-r border-gray-200">ð¹ð­ +66</span>
              <input
                type="tel" value={(editData.mobile ?? '').replace(/^\+66/, '')}
                onChange={e => setEditData(d => ({ ...d, mobile: `+66${e.target.value.replace(/^0/, '')}` }))}
                placeholder="812 345 678"
                className="flex-1 px-4 py-3.5 text-base focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email</label>
            <input
              type="email" value={editData.email ?? ''}
              onChange={e => setEditData(d => ({ ...d, email: e.target.value }))}
              placeholder="customer@email.com"
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notes</label>
            <textarea
              rows={2} value={editData.notes ?? ''}
              onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
              placeholder="Allergies, preferences..."
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Address</label>
            <textarea
              rows={2} value={editData.address ?? ''}
              onChange={e => setEditData(d => ({ ...d, address: e.target.value }))}
              placeholder="House number, street, area..."
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              <MapPin size={12} /> Delivery Location
            </label>
            <p className="text-xs text-gray-400 mb-2">Tap the map or drag the pin to mark drop-off point.</p>
            <React.Suspense fallback={<div style={{height:220,background:"#f3f4f6",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af",fontSize:13}}>Loading mapâ¦</div>}>
                    <DeliveryMap
              lat={editData.deliveryLat}
              lng={editData.deliveryLng}
              onChange={(lat, lng) => setEditData(d => ({ ...d, deliveryLat: lat, deliveryLng: lng }))}
            />
                    </React.Suspense>
                    {editData.deliveryLat && (
              <p className="text-[10px] text-gray-400 font-mono mt-1">
                {editData.deliveryLat.toFixed(6)}, {editData.deliveryLng?.toFixed(6)}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Delivery Notes</label>
            <textarea
              rows={2} value={editData.deliveryNotes ?? ''}
              onChange={e => setEditData(d => ({ ...d, deliveryNotes: e.target.value }))}
              placeholder="Gate code, floor, landmark..."
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta resize-none"
            />
          </div>
        </div>

        <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 p-4 max-w-lg mx-auto">
          <button
            onClick={handleSaveEdit}
            disabled={saving}
            className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Save Changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text" value={query_} onChange={e => setQuery_(e.target.value)}
            placeholder="Search customersâ¦"
            className="w-full pl-12 pr-4 py-3.5 bg-gray-50 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-terracotta text-base"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="w-full flex items-center gap-4 px-5 py-4 border-b border-gray-50 hover:bg-cream/40 transition-colors active:bg-cream"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
              c.loyaltyEnabled ? 'bg-terracotta/10 text-terracotta' : 'bg-gray-100 text-gray-400'
            }`}>
              {c.firstName[0]}{c.lastName?.[0] ?? ''}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-bold text-ink flex items-center gap-1.5">
                {c.firstName} {c.lastName}
                {c.loyaltyEnabled && <Star size={12} className="text-terracotta" fill="currentColor" />}
              </p>
              <p className="text-xs text-gray-400">{c.mobile || c.email || 'No contact info'}</p>
            </div>
            {c.loyaltyEnabled && (
              <span className="text-sm font-bold text-ink shrink-0">à¸¿{(c.balance ?? 0).toLocaleString()}</span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
              <User size={40} />
            </div>
            <div>
              <p className="font-bold text-ink">No customers found{query_ ? ` for "${query_}"` : ''}</p>
            </div>
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold shadow-lg"
            >
              <UserPlus size={18} /> Register New Customer
            </button>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <button
          onClick={() => setShowRegister(true)}
          className="w-full py-4 bg-ink text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg"
        >
          <UserPlus size={20} /> Register New Customer
        </button>
      </div>
    </div>
  );
}

// ââ Expenses ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
const EXPENSE_CATEGORIES = [
  { id: 'food',      name: 'Food & Ingredients' },
  { id: 'drinks',    name: 'Drinks & Beverages' },
  { id: 'packaging', name: 'Packaging' },
  { id: 'utilities', name: 'Utilities' },
  { id: 'staff',     name: 'Staff' },
  { id: 'equipment', name: 'Equipment' },
  { id: 'rent',      name: 'Rent' },
  { id: 'other',     name: 'Other' },
];

function TodaySummary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editTotal, setEditTotal] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    const q = query(collection(db, 'finance_expenses'), where('date', '==', today), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, snap => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [open]);

  const total = expenses.reduce((s, e) => s + (e.total || 0), 0);
  const fmt = (n: number) => `à¸¿${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteDoc(doc(db, 'finance_expenses', id));
      toast.success('Expense deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const handleEditSave = async () => {
    if (!editingExpense) return;
    try {
      await updateDoc(doc(db, 'finance_expenses', editingExpense.id), {
        total: parseFloat(editTotal) || 0,
        supplier: editSupplier,
        notes: editNotes,
      });
      toast.success('Expense updated');
      setEditingExpense(null);
    } catch { toast.error('Failed to update'); }
  };

  const byCategory: Record<string, number> = {};
  expenses.forEach(e => { byCategory[e.category_name] = (byCategory[e.category_name] || 0) + (e.total || 0); });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="mt-auto bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-200" /></div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Today's Expenses</h2>
            <p className="text-xs text-gray-400">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X size={20} className="text-gray-500" /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {expenses.length === 0 ? (
            <div className="text-center py-12"><ClipboardList size={40} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">No expenses logged today.</p></div>
          ) : expenses.map(e => (
            <div key={e.id} className="bg-gray-50 rounded-2xl px-4 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold uppercase tracking-wide text-terracotta bg-terracotta/10 px-2 py-0.5 rounded-full">{e.category_name}</span>
                  <p className="font-semibold text-gray-900 mt-1 truncate">{e.supplier || 'No supplier'}</p>
                  <p className="text-xs text-gray-400">by {e.logged_by} Â· {e.created_at ? new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <p className="font-bold text-gray-900 text-lg">{fmt(e.total || 0)}</p>
                  <button onClick={() => { setEditingExpense(e); setEditTotal(String(e.total || '')); setEditSupplier(e.supplier || ''); setEditNotes(e.notes || ''); }} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500"><Pencil size={15} /></button>
                  <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {expenses.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">By Category</p>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-sm"><span className="text-gray-600">{cat}</span><span className="font-semibold text-gray-900">{fmt(amt as number)}</span></div>
            ))}
          </div>
        )}
        {editingExpense && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setEditingExpense(null)}>
            <div className="bg-white w-full max-w-lg rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg">Edit Expense</h3>
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</label><input value={editSupplier} onChange={e => setEditSupplier(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-terracotta" /></div>
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total (à¸¿)</label><input type="number" value={editTotal} onChange={e => setEditTotal(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-terracotta" /></div>
              <div><label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label><input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-terracotta" /></div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditingExpense(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
                <button onClick={handleEditSave} className="flex-1 py-3 rounded-xl bg-terracotta text-white font-semibold text-sm">Save</button>
              </div>
            </div>
          </div>
        )}
        <div className="px-6 py-5 bg-gray-900">
          <div className="flex justify-between items-center">
            <div><p className="text-xs text-gray-400 uppercase tracking-wider">Total today</p><p className="text-xs text-gray-500 mt-0.5">{expenses.length} receipt{expenses.length !== 1 ? 's' : ''}</p></div>
            <p className="text-3xl font-bold text-white">{fmt(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpenseTab({ user }: { user: any }) {
  const [step, setStep] = useState<'capture' | 'review' | 'saving' | 'done'>('capture');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    supplier: '',
    category_id: 'food',
    category_name: 'Food & Ingredients',
    total: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<LineItem>({ description: '', amount: 0 });

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const q = query(collection(db, 'finance_expenses'), where('date', '==', today));
    return onSnapshot(q, snap => setTodayCount(snap.size));
  }, []);

  const reset = () => {
    setStep('capture'); setImageFile(null); setImagePreview(null);
    setFormData({ date: new Date().toISOString().slice(0, 10), supplier: '', category_id: 'food', category_name: 'Food & Ingredients', total: '', notes: '' });
    setLineItems([]);
    setEditingIdx(null);
  };

  const handleImageSelected = async (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = e => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setStep('review');
    setScanning(true);
    try {
      const base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      const response = await fetch('/api/ocr-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: file.type }) });
      const result = await response.json();
      if (result.success && result.data) {
        const d = result.data;
        setFormData(prev => ({ ...prev, supplier: d.supplier || prev.supplier, date: d.date || prev.date, total: d.total ? String(d.total) : prev.total }));
        if (Array.isArray(d.items)) {
          setLineItems(d.items
            .filter((item: any) => item.description && (item.total_price != null || item.unit_price != null))
            .map((item: any): LineItem => ({
              description: item.description,
              amount: item.total_price ?? item.unit_price ?? 0,
              quantity: item.quantity ?? undefined,
              weight: item.unit || undefined,
            }))
          );
        }
        toast.success('Receipt scanned â');
      } else { toast.error('Could not read receipt â fill in manually'); }
    } catch { toast.error('Scan failed â fill in manually'); }
    finally { setScanning(false); }
  };

  const handleSave = async () => {
    if (!formData.total || !formData.date) { toast.error('Fill in date and total amount'); return; }
    setStep('saving');
    try {
      let receipt_url = '';
      if (imageFile) {
        const storageRef = ref(storage, `receipts/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        receipt_url = await getDownloadURL(storageRef);
      }
      const expenseRef = await addDoc(collection(db, 'finance_expenses'), {
        date: formData.date, supplier: formData.supplier, category_id: formData.category_id,
        category_name: formData.category_name, total: parseFloat(formData.total), currency: 'THB',
        receipt_url, notes: formData.notes, logged_by: user?.email || 'unknown', created_at: new Date().toISOString(),
        ...(lineItems.length > 0 && { line_items: lineItems }),
      });
      if (formData.category_id === 'food' && lineItems.length > 0) {
        await Promise.all(lineItems.filter(item => item.description).map(item =>
          addDoc(collection(db, 'ingredient_purchases'), {
            ingredient_name: item.description,
            supplier: formData.supplier,
            quantity: item.quantity ?? 1,
            unit: item.weight || 'piece',
            unit_cost: item.quantity ? Math.round((item.amount / item.quantity) * 100) / 100 : item.amount,
            total_cost: item.amount,
            date: formData.date,
            expense_id: expenseRef.id,
            logged_by: user?.email || 'unknown',
            created_at: new Date().toISOString(),
          })
        ));
      }
      if (formData.category_id === 'food') {
        await addDoc(collection(db, 'ingredient_purchases'), {
          ingredient_name: formData.supplier || 'Unknown',
          supplier: formData.supplier || '',
          quantity: 1,
          unit: 'purchase',
          unit_cost: parseFloat(formData.total) || 0,
          total_cost: parseFloat(formData.total) || 0,
          date: formData.date,
          expense_id: expenseRef.id,
          logged_by: user?.email || 'unknown',
          created_at: new Date().toISOString(),
        });
      }
      await logActivity('Expense Logged', `à¸¿${parseFloat(formData.total).toLocaleString()} Â· ${formData.category_name} Â· ${formData.supplier || 'no supplier'} Â· ${formData.date}`, 'finance');
      setStep('done');
    } catch { toast.error('Failed to save'); setStep('review'); }
  };

  if (step === 'done') return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center"><Check size={40} className="text-green-600" /></div>
      <div><h2 className="text-2xl font-bold text-gray-900">Expense Saved!</h2><p className="text-gray-500 mt-1">à¸¿{parseFloat(formData.total || '0').toLocaleString()} logged.</p></div>
      <button onClick={reset} className="w-full max-w-xs py-4 bg-terracotta text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg"><Plus size={20} /> Log Another</button>
      <button onClick={() => setShowSummary(true)} className="w-full max-w-xs py-4 border-2 border-gray-200 text-gray-700 rounded-2xl font-bold text-lg flex items-center justify-center gap-2"><ClipboardList size={20} /> Today's Summary</button>
      <TodaySummary open={showSummary} onClose={() => setShowSummary(false)} />
    </div>
  );

  if (step === 'capture') return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div><h2 className="font-bold text-lg text-ink">Log Expense</h2><p className="text-xs text-gray-400">Hi {user?.displayName || user?.email?.split('@')[0]}</p></div>
        <button onClick={() => setShowSummary(true)} className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200">
          <ClipboardList size={20} className="text-gray-600" />
          {todayCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-terracotta text-white text-xs font-bold flex items-center justify-center">{todayCount}</span>}
        </button>
      </div>
      <div className="flex-1 p-5 flex flex-col gap-4 max-w-md mx-auto w-full">
        <button onClick={() => cameraInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 py-7 bg-terracotta text-white rounded-3xl text-xl font-bold hover:bg-terracotta/90 shadow-xl">
          <Camera size={28} /> Take Photo
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 py-5 border-2 border-gray-200 text-gray-700 rounded-3xl text-lg font-semibold hover:bg-gray-50">
          <Upload size={22} /> Upload from Gallery
        </button>
        <button onClick={() => setStep('review')} className="w-full py-4 border border-dashed border-gray-300 rounded-2xl text-gray-400 text-sm hover:border-terracotta hover:text-terracotta transition-all">
          Enter manually (no receipt)
        </button>
      </div>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageSelected(e.target.files[0])} />
      <TodaySummary open={showSummary} onClose={() => setShowSummary(false)} />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <button onClick={reset} className="text-terracotta font-semibold text-sm flex items-center gap-1 px-3 py-3 -ml-3 rounded-xl">â Back</button>
        <h2 className="font-bold text-gray-900">Review Expense</h2>
        {scanning ? <span className="text-xs text-terracotta flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Scanningâ¦</span> : <div className="w-16" />}
      </div>
      <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full pb-32 space-y-4">
        {imagePreview && (
          <div className="relative">
            <img src={imagePreview} alt="Receipt" onClick={() => setLightbox(true)} className="w-full max-h-44 object-contain rounded-2xl border border-gray-200 bg-gray-50 cursor-zoom-in" />
            {scanning && <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center"><div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold text-terracotta"><Loader2 size={16} className="animate-spin" /> Readingâ¦</div></div>}
          </div>
        )}
        {lightbox && imagePreview && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
            <img src={imagePreview} alt="Receipt" className="max-w-full max-h-full rounded-xl object-contain" />
            <button onClick={() => setLightbox(false)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"><X size={20} /></button>
          </div>
        )}
        <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Date</label><input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta" /></div>
        <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Supplier / Shop</label><input type="text" value={formData.supplier} onChange={e => setFormData(p => ({ ...p, supplier: e.target.value }))} placeholder="e.g. Makro" className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta" /></div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
          <div className="relative">
            <select value={formData.category_id} onChange={e => { const cat = EXPENSE_CATEGORIES.find(c => c.id === e.target.value); setFormData(p => ({ ...p, category_id: e.target.value, category_name: cat?.name || e.target.value })); }} className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta appearance-none pr-10">
              {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Amount (à¸¿)</label>
          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">à¸¿</span><input type="number" inputMode="decimal" value={formData.total} onChange={e => setFormData(p => ({ ...p, total: e.target.value }))} placeholder="0.00" className="w-full border-2 border-gray-200 rounded-2xl pl-10 pr-4 py-4 text-3xl font-bold focus:outline-none focus:ring-2 focus:ring-terracotta" /></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Line Items{lineItems.length > 0 ? ` (${lineItems.length})` : ''}</label>
            {lineItems.length > 0 && editingIdx === null && (
              <button type="button" onClick={() => setLineItems([])} className="text-xs text-gray-400 hover:text-red-500">Clear all</button>
            )}
          </div>
          <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
            {lineItems.map((item, i) => (
              editingIdx === i ? (
                <div key={i} className="p-3 space-y-2 bg-gray-50">
                  <input autoFocus value={editBuf.description} onChange={e => setEditBuf(p => ({...p, description: e.target.value}))} placeholder="Description" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  <div className="flex gap-2">
                    <input value={editBuf.quantity ?? ''} onChange={e => setEditBuf(p => ({...p, quantity: e.target.value ? Number(e.target.value) : undefined}))} placeholder="Qty" type="number" inputMode="numeric" className="w-16 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                    <input value={editBuf.weight ?? ''} onChange={e => setEditBuf(p => ({...p, weight: e.target.value || undefined}))} placeholder="Unit (kgâ¦)" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                    <input value={editBuf.amount || ''} onChange={e => setEditBuf(p => ({...p, amount: Number(e.target.value)}))} placeholder="Amount" type="number" inputMode="decimal" className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setLineItems(prev => prev.map((it, idx) => idx === i ? {...editBuf} : it)); setEditingIdx(null); }} className="flex-1 py-2 bg-terracotta text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1"><Check size={14} /> Save</button>
                    <button type="button" onClick={() => { if (!item.description) setLineItems(prev => prev.filter((_, idx) => idx !== i)); setEditingIdx(null); }} className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500">Cancel</button>
                    <button type="button" onClick={() => { setLineItems(prev => prev.filter((_, idx) => idx !== i)); setEditingIdx(null); }} className="px-3 py-2 border border-red-100 text-red-400 rounded-xl text-sm"><Trash2 size={14} /></button>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer active:bg-gray-50" onClick={() => { setEditBuf({...item}); setEditingIdx(i); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.description || <span className="text-gray-400 italic">untitled</span>}</p>
                    {(item.quantity || item.weight) && <p className="text-xs text-gray-400">{[item.quantity, item.weight].filter(Boolean).join(' ')}</p>}
                  </div>
                  <span className="text-sm font-semibold text-gray-900 shrink-0">&#3647;{item.amount.toLocaleString()}</span>
                  <Pencil size={12} className="text-gray-300 shrink-0" />
                </div>
              )
            ))}
            <button type="button" onClick={() => { const blank: LineItem = { description: '', amount: 0 }; setLineItems(prev => [...prev, blank]); setEditBuf(blank); setEditingIdx(lineItems.length); }} className="w-full py-2.5 text-sm text-terracotta font-medium flex items-center justify-center gap-1 hover:bg-gray-50"><Plus size={14} /> Add item</button>
          </div>
        </div>
        <div><label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label><input type="text" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} placeholder="Any extra details" className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-terracotta" /></div>
      </div>
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 p-4 max-w-lg mx-auto">
        <button onClick={handleSave} disabled={step === 'saving' || scanning} className="w-full py-4 bg-terracotta text-white rounded-2xl font-bold text-lg disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
          {step === 'saving' ? <><Loader2 size={20} className="animate-spin" /> Savingâ¦</> : <><Check size={20} /> Save Expense</>}
        </button>
      </div>
    </div>
  );
}

// ââ Main portal ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function CashierPortal() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'loyalty' | 'crm' | 'expenses'>('loyalty');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (['cashier', 'manager', 'admin'].includes(data.role)) {
            setUser({ ...data, uid: firebaseUser.uid });
          } else {
            await signOut(auth); setUser(null);
          }
        } else {
          await signOut(auth); setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-terracotta to-terracotta/80 flex items-center justify-center">
        <Loader2 size={40} className="text-white animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-terracotta rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <div>
            <p className="text-xs font-bold text-ink leading-none">Cajun Life Cafe</p>
            <p className="text-[10px] text-gray-400">{user.displayName || user.email?.split('@')[0]}</p>
          </div>
        </div>
        <button
          onClick={() => signOut(auth).then(() => setUser(null))}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'loyalty' ? <LoyaltyTab user={user} /> : activeTab === 'crm' ? <CRMTab user={user} /> : <ExpenseTab user={user} />}
      </div>

      {/* Bottom nav */}
      <div className="bg-white border-t border-gray-100 flex shrink-0 safe-area-bottom">
        <button
          onClick={() => setActiveTab('loyalty')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all ${
            activeTab === 'loyalty' ? 'text-terracotta' : 'text-gray-400'
          }`}
        >
          <Wallet size={22} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Loyalty</span>
        </button>
        <button
          onClick={() => setActiveTab('crm')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all ${
            activeTab === 'crm' ? 'text-terracotta' : 'text-gray-400'
          }`}
        >
          <User size={22} />
          <span className="text-[10px] font-bold uppercase tracking-widest">CRM</span>
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all ${
            activeTab === 'expenses' ? 'text-terracotta' : 'text-gray-400'
          }`}
        >
          <Receipt size={22} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Expenses</span>
        </button>
      </div>
    </div>
  );
}
