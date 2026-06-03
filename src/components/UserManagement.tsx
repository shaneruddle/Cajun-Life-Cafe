import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { 
  Users, 
  Shield, 
  User as UserIcon, 
  Mail, 
  Calendar, 
  Clock,
  Search,
  MoreVertical,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(userList);
      setLoading(false);
    }, (err) => {
      console.error("Users snapshot error:", err);
      setError("Failed to load users. You might not have permission.");
      setLoading(false);
      handleFirestoreError(err, 'list' as OperationType, 'users');
    });

    return () => unsubscribe();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'manager' | 'marketing' | 'cashier' | 'employee') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      await logActivity('User Role Updated', `Updated user ID: ${userId} role to ${newRole}`, 'user');
      setSuccess(`User role updated to ${newRole}`);
      setEditingRole(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Role update error:", err);
      setError("Failed to update role.");
      handleFirestoreError(err, 'update' as OperationType, `users/${userId}`);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 pt-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-terracotta/10 rounded-2xl flex items-center justify-center text-terracotta">
              <Users size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-ink">User Management</h1>
              <p className="text-gray-500">Manage user roles and permissions for the dashboard.</p>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center gap-3 rounded-r-lg">
            <Check size={20} />
            <p>{success}</p>
          </div>
        )}

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
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Joined</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Last Login</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      No users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                            <UserIcon size={20} />
                          </div>
                          <div>
                            <div className="font-bold text-ink">{user.displayName || 'Anonymous'}</div>
                            <div className="text-xs text-gray-400 flex items-center gap-1">
                              <Mail size={12} /> {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingRole === user.id ? (
                          <div className="flex items-center gap-2">
                            <select 
                              className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-terracotta bg-white"
                              defaultValue={user.role}
                              onChange={(e) => handleRoleChange(user.id!, e.target.value as any)}
                              autoFocus
                            >
                              <option value="employee">Employee</option>
                              <option value="cashier">Cashier</option>
                              <option value="marketing">Marketing</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button 
                              onClick={() => setEditingRole(null)} 
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => user.email !== auth.currentUser?.email && setEditingRole(user.id!)}
                            className={`group px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit transition-all ${
                              user.email !== auth.currentUser?.email ? 'hover:ring-2 hover:ring-terracotta/20 cursor-pointer' : 'cursor-default'
                            } ${
                              user.role === 'admin' 
                                ? 'bg-purple-100 text-purple-700' 
                                : user.role === 'marketing'
                                ? 'bg-indigo-100 text-indigo-700'
                                : user.role === 'cashier'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                            title={user.email !== auth.currentUser?.email ? "Click to change role" : "You cannot change your own role"}
                          >
                            {user.role === 'admin' && <Shield size={10} />}
                            {user.role}
                            {user.email !== auth.currentUser?.email && (
                              <MoreVertical size={10} className="opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => setEditingRole(editingRole === user.id ? null : user.id!)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            user.email === auth.currentUser?.email 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-terracotta hover:bg-terracotta/10'
                          }`}
                          disabled={user.email === auth.currentUser?.email}
                          title={user.email === auth.currentUser?.email ? "You cannot change your own role" : "Change user role"}
                        >
                          <Shield size={14} />
                          {editingRole === user.id ? 'Cancel' : 'Change Role'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
