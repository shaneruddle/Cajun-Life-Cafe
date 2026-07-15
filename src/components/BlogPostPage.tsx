import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { BlogPost } from '../types';
import { FirebaseImage } from './ui/FirebaseImage';
import { normalizeImageUrl } from '../utils/images';
import MarkdownContent from './MarkdownContent';
import { ArrowLeft, Calendar, User } from 'lucide-react';

// Sets <title> and the meta description tag directly — the project doesn't
// have react-helmet or similar installed, and a couple of DOM calls in a
// useEffect is enough for a small per-post SEO override.
function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    let tag = document.querySelector('meta[name="description"]');
    const prevContent = tag?.getAttribute('content') || '';
    if (description) {
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', 'description');
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', description);
    }

    return () => {
      document.title = prevTitle;
      if (tag && description) tag.setAttribute('content', prevContent);
    };
  }, [title, description]);
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    const q = query(collection(db, 'blog_posts'), where('slug', '==', slug), limit(1));
    getDocs(q)
      .then((snap) => {
        const doc = snap.docs[0];
        if (!doc || doc.data().status !== 'published') {
          setNotFound(true);
          setPost(null);
        } else {
          setPost({ id: doc.id, ...doc.data() } as BlogPost);
        }
      })
      .catch((err) => {
        console.error('Blog post fetch error:', err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useDocumentMeta(
    post ? (post.seoTitle || post.title) + ' — Cajun Life Cafe' : 'Cajun Life Cafe',
    post?.seoDescription || post?.excerpt
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-terracotta"></div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-display font-bold text-ink mb-3">Post not found</h1>
        <p className="text-gray-500 mb-8">This post may have been unpublished or the link is incorrect.</p>
        <Link to="/blog" className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full font-bold hover:bg-opacity-90 transition-all">
          <ArrowLeft size={16} /> Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <article>
        <section className="relative bg-ink text-white py-24 px-6 overflow-hidden">
          <div className="max-w-3xl mx-auto relative z-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <Link to="/blog" className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-bold mb-6 transition-colors">
                <ArrowLeft size={14} /> Back to Blog
              </Link>
              {post.category && (
                <span className="inline-block bg-terracotta/20 text-terracotta font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                  {post.category}
                </span>
              )}
              <h1 className="text-3xl md:text-5xl font-display font-bold mb-6 leading-tight">{post.title}</h1>
              <div className="flex flex-wrap items-center gap-5 text-sm text-white/60">
                {post.publishedAt && (
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                )}
                {post.authorName && (
                  <span className="flex items-center gap-1.5">
                    <User size={14} /> {post.authorName}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16 px-6">
          <div className="max-w-3xl mx-auto">
            {post.coverImage && (
              <div className="rounded-[32px] overflow-hidden mb-12 shadow-lg h-72 md:h-96 bg-gray-100">
                <FirebaseImage src={normalizeImageUrl(post.coverImage)} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}
            <MarkdownContent markdown={post.body} className="text-base md:text-lg" />
          </div>
        </section>
      </article>
    </div>
  );
}
