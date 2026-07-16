import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { syncStaffDirectory, removeStaffDirectoryEntry } from '../utils/staffDirectory';
import {
  Users,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Search,
  Check,
  X,
  AlertCircle,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Ban,
  RotateCcw,
  Briefcase,
  Banknote,
  StickyNote,
  Hourglass
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ROLES: UserProfile['role'][] = ['admin', 'manager', 'marketing', 'cashier', 'employee'];

const emptyForm: Partial<UserProfile> = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  phone: '',
  address: '',
  role: 'employee',
  position: '',
  startDate: '',
  salary: undefined,
  ssoDeduction: undefined,
  otHourlyRate: undefined,
  payrollNotes: '',
  bankBranch: '',
  bankAccountNumber: '',
  notes: '',
};

const roleBadgeClass = (role: string) =>
  role === 'admin'
    ? 'bg-purple-100 text-purple-700'
    : role === 'manager'
    ? 'bg-amber-100 text-amber-700'
    : role === 'marketing'
    ? 'bg-indigo-100 text-indigo-700'
    : role === 'cashier'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-gray-100 text-gray-500';

const fmtSalary = (salary?: number) =>
  typeof salary === 'number' ? `฿${salary.toLocaleString()}` : '—';

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : '—');

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingUser, setViewingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() })) as UserProfile[];
      // Superseded docs are the leftover placeholder shells from claimed
      // pending profiles — hide them, the real uid-keyed doc is what matters.
      setUsers(userList.filter((u) => !u.superseded));
      setLoading(false);
    }, (err) => {
      console.error('Users snapshot error:', err);
      setError('Failed to load users. You might not have permission.');
      setLoading(false);
      handleFirestoreError(err, 'list' as OperationType, 'users');
    });
    return () => unsubscribe();
  }, []);

  // One-time backfill: populate staff_directory for any existing eligible
  // profiles that predate this feature. Ongoing changes are kept in sync by
  // the syncStaffDirectory calls in handleSave / handleToggleDisabled /
  // handleRoleChange below (and claimPendingProfile in userClaim.ts).
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        await Promise.all(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
            .filter((u) => !u.superseded)
            .map((u) =>
              syncStaffDirectory({
                uid: u.id!,
                role: u.role,
                disabled: u.disabled,
                pending: u.pending,
                displayName: u.displayName,
                firstName: u.firstName,
                lastName: u.lastName,
                nickname: u.nickname,
                email: u.email,
              })
            )
        );
      } catch (err) {
        console.error('Staff directory backfill failed:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const resetForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
    setFormData(emptyForm);
  };

  const startEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormData(user);
    setIsFormOpen(true);
  };

  const startAdd = () => {
    setEditingUser(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const isSelf = (user: UserProfile) => user.email?.toLowerCase() === auth.currentUser?.email?.toLowerCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = (formData.email || '').trim().toLowerCase();
    if (!formData.firstName?.trim() && !formData.lastName?.trim()) {
      setError('Please enter at least a first or last name.');
      return;
    }
    // Email is optional — some staff (e.g. back-of-house who never use the
    // Cashier Portal or dashboard) will never sign in, so there's nothing
    // to link a login to. They still get a full profile for payroll/
    // staff_directory purposes; they just won't auto-claim on login.
    setSaving(true);
    try {
      const displayName = [formData.firstName, formData.lastName].filter(Boolean).join(' ').trim();
      const now = new Date().toISOString();

      if (editingUser?.id) {
        // Editing an existing profile (pending or claimed). Never touch
        // uid/pending/superseded/createdAt here — those are lifecycle fields.
        await updateDoc(doc(db, 'users', editingUser.id), {
          firstName: formData.firstName || '',
          lastName: formData.lastName || '',
          nickname: formData.nickname || '',
          displayName,
          email,
          phone: formData.phone || '',
          address: formData.address || '',
          role: formData.role || 'employee',
          position: formData.position || '',
          startDate: formData.startDate || '',
          salary: formData.salary ?? null,
          ssoDeduction: formData.ssoDeduction ?? null,
          otHourlyRate: formData.otHourlyRate ?? null,
          payrollNotes: formData.payrollNotes || '',
          bankBranch: formData.bankBranch || '',
          bankAccountNumber: formData.bankAccountNumber || '',
          notes: formData.notes || '',
        });
        await syncStaffDirectory({
          uid: editingUser.id,
          role: formData.role || 'employee',
          disabled: editingUser.disabled,
          pending: editingUser.pending,
          displayName,
          nickname: formData.nickname,
          email,
        });
        await logActivity('User Profile Updated', `Updated profile for ${displayName || email}`, 'user');
        setSuccess('Profile updated successfully!');
      } else {
        // Creating a brand-new pre-provisioned profile — no Firebase Auth
        // account exists yet. It gets linked automatically the first time
        // this person signs up or logs in with a matching email (see
        // src/utils/userClaim.ts). It's still `pending` at this point, but
        // it DOES show up in staff_directory immediately (see
        // syncStaffDirectory) so it can be tagged on payroll expenses even
        // if this person never logs into the Cashier Portal.
        // Blank emails aren't a meaningful "duplicate" of each other — only
        // check for a collision when an email was actually entered.
        if (email) {
          const existing = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
          const alreadyExists = existing.docs.some((d) => !d.data().superseded);
          if (alreadyExists) {
            setError('A profile with this email already exists.');
            setSaving(false);
            return;
          }
        }
        const newRef = doc(collection(db, 'users'));
        await setDoc(newRef, {
          uid: newRef.id,
          firstName: formData.firstName || '',
          lastName: formData.lastName || '',
          nickname: formData.nickname || '',
          displayName,
          email,
          phone: formData.phone || '',
          address: formData.address || '',
          role: formData.role || 'employee',
          position: formData.position || '',
          startDate: formData.startDate || '',
          salary: formData.salary ?? null,
          ssoDeduction: formData.ssoDeduction ?? null,
          otHourlyRate: formData.otHourlyRate ?? null,
          payrollNotes: formData.payrollNotes || '',
          bankBranch: formData.bankBranch || '',
          bankAccountNumber: formData.bankAccountNumber || '',
          notes: formData.notes || '',
          pending: true,
          createdAt: now,
        });
        await syncStaffDirectory({
          uid: newRef.id,
          role: formData.role || 'employee',
          disabled: false,
          displayName,
          nickname: formData.nickname,
          email,
        });
        await logActivity('User Profile Created', `Created pending profile for ${displayName || email || newRef.id}`, 'user');
        setSuccess(
          email
            ? 'Profile created — it will link automatically when they first sign in with this email.'
            : 'Profile created — no email on file, so it won\'t link to a login. Add one later if this person needs Cashier Portal / dashboard access.'
        );
      }
      resetForm();
    } catch (err) {
      setError('Failed to save profile.');
      handleFirestoreError(err, (editingUser ? 'update' : 'create') as OperationType, 'users');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDisabled = async (user: UserProfile) => {
    if (isSelf(user)) return;
    const nextDisabled = !user.disabled;
    if (!window.confirm(nextDisabled
      ? `Deactivate ${user.displayName || user.email}? They will immediately lose dashboard/staff portal access.`
      : `Reactivate ${user.displayName || user.email}?`)) return;
    try {
      await updateDoc(doc(db, 'users', user.id!), { disabled: nextDisabled });
      await syncStaffDirectory({
        uid: user.id!,
        role: user.role,
        disabled: nextDisabled,
        pending: user.pending,
        displayName: user.displayName,
        nickname: user.nickname,
        email: user.email,
      });
      await logActivity(
        nextDisabled ? 'User Deactivated' : 'User Reactivated',
        `${user.displayName || user.email} was ${nextDisabled ? 'deactivated' : 'reactivated'}`,
        'user'
      );
      setSuccess(nextDisabled ? 'User deactivated.' : 'User reactivated.');
    } catch (err) {
      setError('Failed to update access.');
      handleFirestoreError(err, 'update' as OperationType, `users/${user.id}`);
    }
  };

  const handleDeletePending = async (user: UserProfile) => {
    if (!window.confirm(`Permanently delete the pending profile for ${user.displayName || user.email}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.id!));
      await removeStaffDirectoryEntry(user.id!);
      await logActivity('User Profile Deleted', `Deleted pending profile for ${user.displayName || user.email}`, 'user');
      setSuccess('Pending profile deleted.');
    } catch (err) {
      setError('Failed to delete profile.');
      handleFirestoreError(err, 'delete' as OperationType, `users/${user.id}`);
    }
  };

  const handleRoleChange = async (user: UserProfile, newRole: UserProfile['role']) => {
    if (isSelf(user)) return;
    try {
      await updateDoc(doc(db, 'users', user.id!), { role: newRole });
      await syncStaffDirectory({
        uid: user.id!,
        role: newRole,
        disabled: user.disabled,
        pending: user.pending,
        displayName: user.displayName,
        nickname: user.nickname,
        email: user.email,
      });
      await logActivity('User Role Updated', `${user.displayName || user.email} role set to ${newRole}`, 'user');
      setSuccess(`Role updated to ${newRole}.`);
    } catch (err) {
      setError('Failed to update role.');
      handleFirestoreError(err, 'update' as OperationType, `users/${user.id}`);
    }
  };

  const filteredUsers = users.filter((user) =>
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 pt-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-terracotta/10 rounded-2xl flex items-center justify-center text-terracotta">
              <Users size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-ink">User Management</h1>
              <p className="text-gray-500">Staff profiles, roles, and payroll details. Admin only.</p>
            </div>
          </div>
          <button
            onClick={startAdd}
            className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all shadow-lg font-bold"
          >
            <Plus size={20} /> Add User
          </button>
        </header>

        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-4 rounded-2xl flex items-center gap-3 ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
            >
              {error ? <AlertCircle size={20} /> : <Check size={20} />}
              <span className="font-medium">{error || success}</span>
              <button onClick={() => { setError(null); setSuccess(null); }} className="ml-auto">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-8 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search users by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
            />
          </div>
        </div>

        <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">User</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Role</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Position</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Salary</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const self = isSelf(user);
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                              <UserIcon size={20} />
                            </div>
                            <div>
                              <div className="font-bold text-ink">
                                {user.displayName || 'Unnamed'}
                                {user.nickname && <span className="text-gray-400 font-normal"> ({user.nickname})</span>}
                              </div>
                              <div className="text-xs text-gray-400 flex items-center gap-1">
                                <Mail size={12} /> {user.email || 'No email on file'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            disabled={self}
                            onChange={(e) => handleRoleChange(user, e.target.value as UserProfile['role'])}
                            title={self ? 'You cannot change your own role' : 'Change role'}
                            className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1 border-none outline-none cursor-pointer ${roleBadgeClass(user.role)} ${self ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.position || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fmtSalary(user.salary)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.disabled ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600">
                              <Ban size={10} /> Deactivated
                            </span>
                          ) : user.pending ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                              <Hourglass size={10} /> Pending Signup
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-olive/10 text-olive">
                              <Check size={10} /> Active
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => setViewingUser(user)} className="p-2 text-gray-400 hover:text-terracotta transition-colors" title="View profile">
                              <Eye size={16} />
                            </button>
                            <button onClick={() => startEdit(user)} className="p-2 text-gray-400 hover:text-olive transition-colors" title="Edit profile">
                              <Pencil size={16} />
                            </button>
                            {user.pending ? (
                              <button onClick={() => handleDeletePending(user)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete pending profile">
                                <Trash2 size={16} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleDisabled(user)}
                                disabled={self}
                                title={self ? 'You cannot deactivate your own account' : (user.disabled ? 'Reactivate' : 'Deactivate')}
                                className={`p-2 transition-colors ${self ? 'text-gray-200 cursor-not-allowed' : user.disabled ? 'text-gray-400 hover:text-olive' : 'text-gray-400 hover:text-red-500'}`}
                              >
                                {user.disabled ? <RotateCcw size={16} /> : <Ban size={16} />}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-2xl font-display font-bold text-ink">
                  {editingUser ? 'Edit User Profile' : 'Add New User'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {!editingUser && (
                <div className="mx-8 mt-6 p-4 bg-amber-50 text-amber-800 rounded-2xl text-sm flex items-start gap-3">
                  <Hourglass size={18} className="shrink-0 mt-0.5" />
                  <p>This creates a profile only — no login yet. It links automatically the first time this person signs up or logs in (Staff Portal or Google) using the same email.</p>
                </div>
              )}

              <form onSubmit={handleSave} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">First Name</label>
                    <input
                      value={formData.firstName || ''}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. Somchai"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Last Name</label>
                    <input
                      value={formData.lastName || ''}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. Jaidee"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Nickname</label>
                    <input
                      value={formData.nickname || ''}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. Som (optional)"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email (optional)</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      disabled={!!editingUser && !editingUser.pending}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={`w-full border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium ${!!editingUser && !editingUser.pending ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-50'}`}
                      placeholder="name@example.com — leave blank if they'll never sign in"
                    />
                    {!!editingUser && !editingUser.pending && (
                      <p className="text-[11px] text-gray-400 mt-1.5">This account has already signed in — email is tied to their login and can't be changed here.</p>
                    )}
                    {!(!!editingUser && !editingUser.pending) && (
                      <p className="text-[11px] text-gray-400 mt-1.5">Only needed if this person will log in to the Cashier Portal or dashboard.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Phone</label>
                    <input
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="08X-XXX-XXXX"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Address</label>
                  <input
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    placeholder="Street, city, province"
                  />
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value as UserProfile['role'] })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Position</label>
                    <input
                      value={formData.position || ''}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. Line Cook"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="p-5 bg-cream rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                    <Banknote size={14} /> Payroll Details
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Salary (฿ / month)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.salary ?? ''}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                        placeholder="25000"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bank Branch</label>
                      <input
                        value={formData.bankBranch || ''}
                        onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })}
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                        placeholder="e.g. Pratumnak"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bank Account Number</label>
                      <input
                        value={formData.bankAccountNumber || ''}
                        onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                        placeholder="XXX-X-XXXXX-X"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">SSO Deduction (฿ / month)</label>
                      <input
                        type="number"
                        min={0}
                        value={formData.ssoDeduction ?? ''}
                        onChange={(e) => setFormData({ ...formData, ssoDeduction: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                        placeholder="750"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">OT Hourly Rate (฿ / hour)</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={formData.otHourlyRate ?? ''}
                        onChange={(e) => setFormData({ ...formData, otHourlyRate: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                        placeholder="65"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Payroll Notes</label>
                    <textarea
                      rows={2}
                      value={formData.payrollNotes || ''}
                      onChange={(e) => setFormData({ ...formData, payrollNotes: e.target.value })}
                      className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none resize-none text-sm"
                      placeholder="e.g. Split payment across two accounts, pay on the 28th, etc."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea
                    rows={3}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none resize-none text-sm"
                    placeholder="Anything else worth noting about this person..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-6 py-4 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : editingUser ? 'Update Profile' : 'Create Profile'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View modal */}
      <AnimatePresence>
        {viewingUser && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${roleBadgeClass(viewingUser.role)}`}>
                    {viewingUser.role}
                  </span>
                  <h2 className="text-2xl font-display font-bold text-ink">
                    {viewingUser.displayName || 'Unnamed'}
                    {viewingUser.nickname && <span className="text-gray-400 font-normal"> ({viewingUser.nickname})</span>}
                  </h2>
                  <p className="text-gray-400 mt-1 flex items-center gap-1 text-sm"><Mail size={14} /> {viewingUser.email || 'No email on file'}</p>
                </div>
                <button onClick={() => setViewingUser(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
              <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-500"><Phone size={14} className="text-gray-300" /> {viewingUser.phone || '—'}</div>
                  <div className="flex items-center gap-2 text-gray-500"><Briefcase size={14} className="text-gray-300" /> {viewingUser.position || '—'}</div>
                  <div className="flex items-center gap-2 text-gray-500"><Calendar size={14} className="text-gray-300" /> Started {fmtDate(viewingUser.startDate)}</div>
                  <div className="flex items-center gap-2 text-gray-500"><Clock size={14} className="text-gray-300" /> Joined {fmtDate(viewingUser.createdAt)}</div>
                </div>
                <div className="flex items-start gap-2 text-gray-500"><MapPin size={14} className="text-gray-300 mt-0.5" /> {viewingUser.address || '—'}</div>

                <div className="p-4 bg-cream rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    <Banknote size={14} /> Payroll Details
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Salary</span><span className="font-bold text-ink">{fmtSalary(viewingUser.salary)} / month</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">SSO Deduction</span><span className="text-ink">{fmtSalary(viewingUser.ssoDeduction)} / month</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">OT Hourly Rate</span><span className="text-ink">{fmtSalary(viewingUser.otHourlyRate)} / hour</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Bank Branch</span><span className="text-ink">{viewingUser.bankBranch || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Account Number</span><span className="text-ink">{viewingUser.bankAccountNumber || '—'}</span></div>
                  {viewingUser.payrollNotes && (
                    <div className="pt-1 border-t border-white">
                      <span className="text-gray-400">Payroll Notes</span>
                      <p className="text-ink whitespace-pre-line mt-1">{viewingUser.payrollNotes}</p>
                    </div>
                  )}
                </div>

                {viewingUser.notes && (
                  <div className="flex items-start gap-2 text-gray-500">
                    <StickyNote size={14} className="text-gray-300 mt-0.5 shrink-0" />
                    <p className="whitespace-pre-line">{viewingUser.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  {viewingUser.disabled ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600">
                      <Ban size={10} /> Deactivated
                    </span>
                  ) : viewingUser.pending ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700">
                      <Hourglass size={10} /> Pending Signup — not linked to a login yet
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-olive/10 text-olive">
                      <Check size={10} /> Active
                    </span>
                  )}
                </div>
              </div>
              <div className="p-8 pt-0 flex gap-4">
                <button
                  onClick={() => { setViewingUser(null); startEdit(viewingUser); }}
                  className="flex-1 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Pencil size={16} /> Edit
                </button>
                <button
                  onClick={() => setViewingUser(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
