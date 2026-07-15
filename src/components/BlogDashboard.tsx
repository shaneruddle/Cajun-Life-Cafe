import React, { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { BlogPost } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import MarkdownEditor from './MarkdownEditor';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  ArrowLeft,
  Newspaper,
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const emptyForm: Partial<BlogPost> = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  coverImage: '',
  category: '',
  seoTitle: '',
  seoDescription: '',
  status: 'draft',
};

export default function BlogDashboard() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BlogPost>>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'blog_posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as BlogPost[];
      setPosts(list);
      setLoading(false);
    }, (err) => {
      console.error('Blog posts snapshot error:', err);
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
    setEditingPost(null);
    setIsAdding(false);
    setFormData(emptyForm);
    setSlugTouched(false);
  };

  const startEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData(post);
    setSlugTouched(true);
    setIsAdding(true);
  };

  const handleTitleChange = (title: string) => {
    setFormData((f) => ({
      ...f,
      title,
      slug: slugTouched ? f.slug : slugify(title),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      setError('Please enter a title.');
      return;
    }
    const slug = slugify(formData.slug || formData.title || '');
    if (!slug) {
      setError('Please enter a valid slug.');
      return;
    }
    setSaving(true);
    try {
      const existing = await getDocs(query(collection(db, 'blog_posts'), where('slug', '==', slug)));
      const clash = existing.docs.find((d) => d.id !== editingPost?.id);
      if (clash) {
        setError('Another post already uses this slug. Please change it.');
        setSaving(false);
        return;
      }

      const now = new Date().toISOString();
      const wasPublished = editingPost?.status === 'published';
      const isPublishingNow = formData.status === 'published';

      const payload: Partial<BlogPost> = {
        ...formData,
        slug,
        updatedAt: now,
        uid: auth.currentUser?.uid,
        authorName: formData.authorName || auth.currentUser?.displayName || auth.currentUser?.email || 'Cajun Life Cafe',
      };
      if (isPublishingNow && !wasPublished) {
        payload.publishedAt = now;
      }

      if (editingPost?.id) {
        await updateDoc(doc(db, 'blog_posts', editingPost.id), payload);
        await logActivity('Blog Post Updated', `Updated post: ${formData.title}`, 'blog');
        setSuccess('Post updated successfully!');
      } else {
        await addDoc(collection(db, 'blog_posts'), {
          ...payload,
          createdAt: now,
        });
        await logActivity('Blog Post Created', `Created post: ${formData.title}`, 'blog');
        setSuccess('Post created successfully!');
      }
      resetForm();
    } catch (err) {
      setError('Failed to save post.');
      handleFirestoreError(err, editingPost ? 'update' : 'create', 'blog_posts');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'blog_posts', id));
      await logActivity('Blog Post Deleted', `Deleted post: ${title}`, 'blog');
      setSuccess('Post deleted successfully!');
    } catch (err) {
      setError('Failed to delete post.');
      handleFirestoreError(err, 'delete', `blog_posts/${id}`);
    }
  };

  const toggleStatus = async (post: BlogPost) => {
    const nextStatus = post.status === 'published' ? 'draft' : 'published';
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'blog_posts', post.id!), {
        status: nextStatus,
        updatedAt: now,
        ...(nextStatus === 'published' && !post.publishedAt ? { publishedAt: now } : {}),
      });
      await logActivity('Blog Post Status Changed', `${post.title} set to ${nextStatus}`, 'blog');
    } catch (err) {
      setError('Failed to update status.');
      handleFirestoreError(err, 'update', `blog_posts/${post.id}`);
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
            <h1 className="text-4xl font-display font-bold text-ink">Blog</h1>
            <p className="text-gray-500 mt-2">Write and manage posts shown on the public /blog page.</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all shadow-lg font-bold"
          >
            <Plus size={20} /> New Post
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
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Updated</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-ink">{post.title}</div>
                      <div className="text-xs text-gray-400">/blog/{post.slug}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{post.category || '—'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(post)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          post.status === 'published'
                            ? 'bg-olive/10 text-olive hover:bg-olive/20'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                      >
                        {post.status === 'published' ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{post.updatedAt ? new Date(post.updatedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {post.status === 'published' && (
                          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-terracotta transition-colors" title="View live">
                            <ExternalLink size={18} />
                          </a>
                        )}
                        <button onClick={() => startEdit(post)} className="p-2 text-gray-400 hover:text-olive transition-colors" title="Edit">
                          <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(post.id!, post.title)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
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

        {posts.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-gray-100 mt-8">
            <Newspaper size={40} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-400 italic">No posts yet. Write one to publish it on /blog.</p>
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
              className="bg-white rounded-[40px] w-full max-w-3xl overflow-hidden shadow-2xl my-8"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-2xl font-display font-bold text-ink">
                  {editingPost ? 'Edit Post' : 'New Post'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Title *</label>
                  <input
                    required
                    value={formData.title || ''}
                    onChange={e => handleTitleChange(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium text-lg"
                    placeholder="e.g. 5 Cajun Dishes You Have to Try in Pattaya"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Slug *</label>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-5 py-3 focus-within:ring-2 focus-within:ring-terracotta">
                      <span className="text-gray-400 text-sm shrink-0">/blog/</span>
                      <input
                        required
                        value={formData.slug || ''}
                        onChange={e => { setSlugTouched(true); setFormData({ ...formData, slug: slugify(e.target.value) }); }}
                        className="w-full bg-transparent border-none outline-none font-medium"
                        placeholder="5-cajun-dishes"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
                    <input
                      value={formData.category || ''}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                      placeholder="e.g. Recipes, News, Events"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Cover Image URL <span className="normal-case font-normal text-gray-400">(paste a link, or upload one in Image Management first)</span>
                  </label>
                  <input
                    value={formData.coverImage || ''}
                    onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium text-sm"
                    placeholder="https://... or gs://cajun-life-cafe.firebasestorage.app/..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Excerpt</label>
                  <textarea
                    rows={2}
                    value={formData.excerpt || ''}
                    onChange={e => setFormData({ ...formData, excerpt: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none resize-none text-sm"
                    placeholder="A short summary shown on the blog listing page..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Body *</label>
                  <MarkdownEditor
                    value={formData.body || ''}
                    onChange={(body) => setFormData({ ...formData, body })}
                    placeholder="Write your post using the toolbar above, or type Markdown directly..."
                  />
                </div>

                <div className="p-5 bg-cream rounded-2xl space-y-4">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">SEO (optional — falls back to title/excerpt)</div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">SEO Title</label>
                    <input
                      value={formData.seoTitle || ''}
                      onChange={e => setFormData({ ...formData, seoTitle: e.target.value })}
                      className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none text-sm"
                      placeholder={formData.title || 'Page title shown in search results'}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">SEO Description</label>
                    <textarea
                      rows={2}
                      value={formData.seoDescription || ''}
                      onChange={e => setFormData({ ...formData, seoDescription: e.target.value })}
                      className="w-full bg-white border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none resize-none text-sm"
                      placeholder={formData.excerpt || 'Meta description shown in search results'}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value as BlogPost['status'] })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-3 focus:ring-2 focus:ring-terracotta outline-none font-medium md:w-64"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
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
                    {saving ? 'Saving…' : editingPost ? 'Update Post' : 'Save Post'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
