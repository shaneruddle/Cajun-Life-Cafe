import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Job } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { Plus, Edit2, Trash2, Save, X, Eye, ArrowLeft, Briefcase, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

// Kept in sync with the department/role options offered on the public
// /careers application form (src/components/CareersPage.tsx) so a job
// posting's department maps 1:1 onto the form's "Role interest" dropdown.
export const DEPARTMENTS = [
  'Kitchen / Chef',
  'Front of House / Waiter',
  'Bar Staff / Bartender',
  'Delivery Driver',
  'Management',
  'Other / Open to anything',
];

const EMPLOYMENT_TYPES: Job['employmentType'][] = ['Full-time', 'Part-time'];

const emptyForm: Partial<Job> = {
  title: '',
  titleThai: '',
  department: DEPARTMENTS[0],
  employmentType: 'Full-time',
  description: '',
  descriptionThai: '',
  status: 'open',
};

export default function JobsDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Job>>(emptyForm);

  useEffect(() => {
    const q = query(collection(db, 'jobs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Job[];
      setJobs(list);
      setLoading(false);
    }, (err) => {
      console.error('Jobs snapshot error:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const resetForm = () => {
    setEditingJob(null);
    setIsAdding(false);
    setFormData(emptyForm);
  };

  const startEdit = (job: Job) => {
    setEditingJob(job);
    setFormData(job);
    setIsAdding(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setError('Please enter a job title.');
      return;
    }
    setError(null);
    const now = new Date().toISOString();
    try {
      if (editingJob?.id) {
        await updateDoc(doc(db, 'jobs', editingJob.id), {
          ...formData,
          updatedAt: now,
          uid: auth.currentUser?.uid,
        });
        await logActivity('Job Updated', `Updated job posting: ${formData.title}`, 'job');
        setSuccess('Job updated successfully!');
      } else {
        await addDoc(collection(db, 'jobs'), {
          ...formData,
          createdAt: now,
          updatedAt: now,
          uid: auth.currentUser?.uid,
        });
        await logActivity('Job Created', `Created job posting: ${formData.title}`, 'job');
        setSuccess('Job added successfully!');
      }
      resetForm();
    } catch (err) {
      setError('Failed to save job.');
      handleFirestoreError(err, editingJob ? 'update' : 'create', 'jobs');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this job posting?')) return;
    try {
      await deleteDoc(doc(db, 'jobs', id));
      await logActivity('Job Deleted', `Deleted job posting ID: ${id}`, 'job');
      setSuccess('Job deleted successfully!');
    } catch (err) {
      setError('Failed to delete job.');
      handleFirestoreError(err, 'delete', `jobs/${id}`);
    }
  };

  const toggleStatus = async (job: Job) => {
    try {
      await updateDoc(doc(db, 'jobs', job.id!), {
        status: job.status === 'open' ? 'closed' : 'open',
        updatedAt: new Date().toISOString(),
      });
      await logActivity('Job Status Changed', `${job.title} set to ${job.status === 'open' ? 'closed' : 'open'}`, 'job');
    } catch (err) {
      setError('Failed to update status.');
      handleFirestoreError(err, 'update', `jobs/${job.id}`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 relative z-0 pt-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-terracotta transition-colors mb-4">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-display font-bold text-ink">Job Postings</h1>
            <p className="text-gray-500 mt-2">Manage open positions shown on the public Careers page.</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all shadow-lg font-bold"
          >
            <Plus size={20} /> Add Job
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

        <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Title</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Department</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink">{job.title}</div>
                      {job.titleThai && <div className="text-xs text-gray-400">{job.titleThai}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{job.department}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{job.employmentType}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(job)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          job.status === 'open'
                            ? 'bg-olive/10 text-olive hover:bg-olive/20'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {job.status === 'open' ? 'Open' : 'Closed'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setViewingJob(job)} className="p-2 text-gray-400 hover:text-terracotta transition-colors">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => startEdit(job)} className="p-2 text-gray-400 hover:text-olive transition-colors">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(job.id!)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-gray-100 mt-8">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-400 italic">No job postings yet. Add one to show it on the Careers page.</p>
          </div>
        )}
      </div>

      {/* Add/Edit modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-2xl font-display font-bold text-ink">
                  {editingJob ? 'Edit Job Posting' : 'Add New Job Posting'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Job Title (English) *</label>
                    <input
                      required
                      value={formData.title || ''}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. Line Cook"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Job Title (Thai) <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                    <input
                      value={formData.titleThai || ''}
                      onChange={e => setFormData({ ...formData, titleThai: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. พนักงานครัว"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Department *</label>
                    <select
                      value={formData.department}
                      onChange={e => setFormData({ ...formData, department: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Employment Type *</label>
                    <select
                      value={formData.employmentType}
                      onChange={e => setFormData({ ...formData, employmentType: e.target.value as Job['employmentType'] })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    >
                      {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Status *</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as Job['status'] })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description (English) *</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description || ''}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none resize-none text-sm"
                    placeholder="What the role involves, hours, requirements..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description (Thai) <span className="normal-case font-normal text-gray-400">(optional — shown to Thai-language applicants)</span></label>
                  <textarea
                    rows={4}
                    value={formData.descriptionThai || ''}
                    onChange={e => setFormData({ ...formData, descriptionThai: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none resize-none text-sm"
                    placeholder="รายละเอียดตำแหน่งงานเป็นภาษาไทย..."
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
                    className="flex-1 px-6 py-4 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingJob ? 'Update Job' : 'Save Job'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View modal */}
      <AnimatePresence>
        {viewingJob && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-2xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${
                    viewingJob.status === 'open' ? 'bg-olive/10 text-olive' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {viewingJob.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                  <h2 className="text-2xl font-display font-bold text-ink">{viewingJob.title}</h2>
                  {viewingJob.titleThai && <p className="text-gray-400 mt-1">{viewingJob.titleThai}</p>}
                  <p className="text-sm text-gray-500 mt-2">{viewingJob.department} &middot; {viewingJob.employmentType}</p>
                </div>
                <button onClick={() => setViewingJob(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description (English)</h3>
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">{viewingJob.description}</p>
                </div>
                {viewingJob.descriptionThai && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description (Thai)</h3>
                    <p className="text-gray-700 whitespace-pre-line leading-relaxed">{viewingJob.descriptionThai}</p>
                  </div>
                )}
              </div>
              <div className="p-8 pt-0 flex gap-4">
                <button
                  onClick={() => { setViewingJob(null); startEdit(viewingJob); }}
                  className="flex-1 px-6 py-3 bg-terracotta text-white rounded-2xl font-bold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 size={18} /> Edit
                </button>
                <button
                  onClick={() => setViewingJob(null)}
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
