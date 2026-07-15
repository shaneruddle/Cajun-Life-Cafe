import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { BlogPost } from '../types';
import { FirebaseImage } from './ui/FirebaseImage';
import { normalizeImageUrl } from '../utils/images';
import { Newspaper, ArrowRight } from 'lucide-react';

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    document.title = 'Blog — Cajun Life Cafe';
  }, []);

  useEffect(() => {
    // Ordering by createdAt (not publishedAt) avoids needing a composite
    // index for a status == + orderBy(other field) query; publish order is
    // close enough in practice and the status filter is applied client-side
    // to keep this simple and index-free.
    const q = query(collection(db, 'blog_posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as BlogPost))
        .filter((p) => p.status === 'published');
      setPosts(list);
      setLoading(false);
    }, (err) => {
      console.error('Blog listing snapshot error:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(posts.map((p) => p.category).filter(Boolean))) as string[];
    return ['All', ...cats];
  }, [posts]);

  const filteredPosts = useMemo(
    () => (activeCategory === 'All' ? posts : posts.filter((p) => p.category === activeCategory)),
    [posts, activeCategory]
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative bg-ink text-white py-28 px-6 overflow-hidden">
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block bg-terracotta/20 text-terracotta font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              From the Kitchen
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">Cajun Life Blog</h1>
            <p className="text-xl text-white/70 max-w-xl mx-auto leading-relaxed">
              Recipes, news, and stories from Cajun Life Cafe in Pattaya.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-terracotta"></div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
              <Newspaper size={40} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-400 italic">Nothing posted yet — check back soon.</p>
            </div>
          ) : (
            <>
              {categories.length > 1 && (
                <div className="flex flex-wrap justify-center gap-3 mb-12">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-6 py-2 rounded-full font-medium transition-all text-sm ${
                        activeCategory === cat ? 'bg-terracotta text-white shadow-lg' : 'bg-white text-ink hover:bg-gray-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredPosts.map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                  >
                    <Link
                      to={`/blog/${post.slug}`}
                      className="group flex flex-col h-full bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all"
                    >
                      <div className="h-48 bg-gray-100 overflow-hidden">
                        <FirebaseImage
                          src={normalizeImageUrl(post.coverImage)}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-6 flex flex-col flex-1">
                        {post.category && (
                          <span className="inline-block w-fit bg-olive/10 text-olive text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                            {post.category}
                          </span>
                        )}
                        <h2 className="font-display font-bold text-lg text-ink mb-2 leading-snug group-hover:text-terracotta transition-colors">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-gray-500 text-sm leading-relaxed line-clamp-3 flex-1">{post.excerpt}</p>
                        )}
                        <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                          <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</span>
                          <span className="flex items-center gap-1 text-terracotta font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                            Read <ArrowRight size={12} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
