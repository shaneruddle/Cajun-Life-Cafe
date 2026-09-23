import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Clock, MapPin, ChevronDown, MessageCircle } from 'lucide-react';
import { db } from '../firebase';
import { MenuItem } from '../types';
import { FirebaseImage } from './ui/FirebaseImage';
import { normalizeImageUrl } from '../utils/images';

// /breakfast — targets "breakfast pattaya", "best english breakfast in
// pattaya", "breakfast near me" etc., where the site already sits on page one
// with no clicks. Dishes and prices come live from the menu's Breakfast
// category, so this page never drifts from the real menu.

const LINE_URL = 'https://line.me/R/ti/p/@cajunlifecafe';
const MAPS_URL = 'https://maps.app.goo.gl/cajunlifecafe';

const FAQS = [
  {
    q: 'Where can I get an English breakfast in Pattaya?',
    a: 'Cajun Life Cafe on Pratumnak Hill serves a full English breakfast — eggs your way, bacon or ham, English sausage, hash browns, baked beans, black pudding and whole-wheat toast — every day from 8am to 10pm.',
  },
  {
    q: 'Do you serve breakfast all day?',
    a: 'Yes. The whole breakfast menu is available all day, every day, from 8:00am until 10:00pm.',
  },
  {
    q: 'Is there a healthy, high-protein breakfast option?',
    a: 'The Healthy Omega Breakfast pairs eggs with smoked salmon, avocado and whole-wheat toast — a high-protein start with healthy fats. The rest of the menu is cooked without refined sugar, with gluten-free options.',
  },
  {
    q: 'Where are you?',
    a: '352/306-307 Pratumnak Soi 5, Pattaya — on Pratumnak Hill between Pattaya and Jomtien. You can also message us on LINE (@cajunlifecafe) to order.',
  },
];

const priceLabel = (price?: string) => (price ? `฿${price.replace('฿', '').trim()}` : '');

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left">
        <span className="font-bold text-ink">{q}</span>
        <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-6 pb-5 text-gray-500 text-sm leading-relaxed">{a}</p>}
    </div>
  );
}

export default function BreakfastPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'menu'), where('published', '==', true));
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[]);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, []);

  const breakfast = useMemo(
    () =>
      items
        .filter((i) => /breakfast/i.test(i.category || ''))
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    [items]
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative bg-ink text-white pt-36 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-olive" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-terracotta" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mx-auto text-center relative z-10"
        >
          <span className="inline-block bg-olive/20 text-olive font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            Breakfast in Pattaya
          </span>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">Breakfast, served all day</h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Full English, American and high-protein breakfasts on Pratumnak Hill — cooked fresh to order, every day
            from 8am to 10pm.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-white/80 text-sm">
            <span className="inline-flex items-center gap-2"><Clock size={16} /> Every day, 8:00am – 10:00pm</span>
            <span className="inline-flex items-center gap-2"><MapPin size={16} /> Pratumnak Soi 5, Pattaya</span>
          </div>
        </motion.div>
      </section>

      {/* Dishes */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-display font-bold text-ink mb-10 text-center">The breakfast menu</h2>
          {breakfast.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-6">
              {breakfast.map((item) => (
                <div key={item.id} className="bg-cream rounded-[28px] overflow-hidden border border-gray-100 shadow-sm flex flex-col">
                  {item.image && (
                    <FirebaseImage
                      src={normalizeImageUrl(item.image)}
                      alt={`${item.name} at Cajun Life Cafe, Pattaya`}
                      className="w-full h-56 object-cover"
                    />
                  )}
                  <div className="p-6 flex-1">
                    <div className="flex items-baseline justify-between gap-4 mb-2">
                      <h3 className="font-bold text-ink text-lg">{item.name}</h3>
                      <span className="text-terracotta font-bold whitespace-nowrap">{priceLabel(item.price)}</span>
                    </div>
                    {item.description && <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 italic py-16">
              {loaded ? (
                <>See today’s breakfasts on the <Link to="/digital-menu" className="underline">full menu</Link>.</>
              ) : (
                'Loading the breakfast menu…'
              )}
            </p>
          )}
          <p className="text-center text-sm text-gray-400 mt-8">
            Also on the menu all day: high-protein Build Your Own bowls, smoothie bowls, Cajun and Thai dishes —{' '}
            <Link to="/healthy-eating" className="underline hover:text-terracotta">see why we’re Pattaya’s healthy-eating choice</Link>.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-ink mb-10 text-center">Breakfast questions</h2>
          <div className="space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-ink text-white text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">Come in for breakfast</h2>
        <p className="text-white/70 mb-8 max-w-xl mx-auto">Pratumnak Soi 5 — open every day from 8am. Message us on LINE to order ahead.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-full font-bold hover:bg-terracotta/90 transition-all shadow-xl">
            <MapPin size={18} /> Get directions
          </a>
          <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-full font-bold hover:bg-white/20 transition-all backdrop-blur-sm">
            <MessageCircle size={18} /> Order on LINE
          </a>
        </div>
      </section>
    </div>
  );
}
