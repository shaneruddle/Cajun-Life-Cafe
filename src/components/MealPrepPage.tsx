import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CustomMealItem } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import {
  Flame,
  Zap,
  Wheat,
  Droplets,
  Leaf,
  BarChart2,
  Sliders,
  Truck,
} from 'lucide-react';

const FEATURES = [
  {
    icon: <Leaf size={28} />,
    title: 'Fresh, no preservatives',
    desc: 'Every meal is cooked to order with clean ingredients — no additives, no shortcuts.',
  },
  {
    icon: <BarChart2 size={28} />,
    title: 'Macro-tracked',
    desc: 'Calories, protein, carbs, and fat listed for every ingredient so you hit your numbers.',
  },
  {
    icon: <Sliders size={28} />,
    title: 'Fully customisable',
    desc: 'Pick your protein, carbs, and portion size. Build a different meal for every day of the week.',
  },
  {
    icon: <Truck size={28} />,
    title: 'Delivery + weekly pricing',
    desc: 'We deliver with our own drivers. Order multiple days and we\'ll sort better pricing for you.',
  },
];

export default function MealPrepPage() {
  const [items, setItems] = useState<CustomMealItem[]>([]);
  const [activeType, setActiveType] = useState<string>('');

  useEffect(() => {
    const q = query(collection(db, 'custom_meals'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CustomMealItem[];
        setItems(data);
        if (data.length > 0 && !activeType) {
          const types = Array.from(new Set(data.map((i) => i.type))).sort();
          setActiveType(types[0] || '');
        }
      },
      (err) => handleFirestoreError(err, 'list', 'custom_meals')
    );
    return () => unsubscribe();
  }, []);

  const types = useMemo(() => Array.from(new Set(items.map((i) => i.type))).sort(), [items]);
  const filteredItems = useMemo(() => items.filter((i) => i.type === activeType), [items, activeType]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative bg-ink text-white py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-olive" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-terracotta" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block bg-terracotta/20 text-terracotta font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              Meal Prep
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
              Fuel your week.<br />We\'ve got the kitchen.
            </h1>
            <p className="text-xl text-white/70 max-w-xl mx-auto leading-relaxed">
              Clean, macro-tracked meals built to your spec — prepped fresh and delivered to your door. Message us on LINE and we\'ll sort the rest.
            </p>
            <div className="mt-10">
              <a
                href="https://line.me/R/ti/p/@cajunlifecafe"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-full font-bold text-lg hover:bg-terracotta/90 transition-all shadow-xl"
              >
                Start your meal prep on LINE
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon, title, desc }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="bg-cream rounded-[28px] p-7 border border-gray-100"
              >
                <div className="w-12 h-12 bg-olive/10 rounded-2xl flex items-center justify-center text-olive mb-5">
                  {icon}
                </div>
                <h3 className="font-bold text-ink mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 bg-cream">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-display font-bold text-ink mb-10">How it works</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { step: '01', label: 'Browse below', desc: 'Pick your proteins, carbs, and portions from the menu.' },
              { step: '02', label: 'Message us on LINE', desc: 'Tell us what you want, how many days, and your delivery address.' },
              { step: '03', label: 'We prep & deliver', desc: 'Fresh meals cooked and brought to your door by our own drivers.' },
            ].map(({ step, label, desc }) => (
              <div key={step} className="text-center">
                <div className="w-12 h-12 bg-terracotta/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <span className="text-terracotta font-display font-bold">{step}</span>
                </div>
                <p className="font-bold text-ink text-sm mb-1">{label}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <a
              href="https://line.me/R/ti/p/@cajunlifecafe"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-olive text-white rounded-full font-bold hover:bg-olive/90 transition-all shadow-lg"
            >
              Open LINE Chat
            </a>
          </div>
        </div>
      </section>

      {/* Ingredient selector */}
      <section id="menu" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Build Your Prep Meals</h2>
            <p className="text-lg text-gray-600 italic max-w-2xl mx-auto">
              Choose your ingredients and message us on LINE with your selection. We\'ll confirm portions, days, and pricing.
            </p>
            <div className="h-1 w-24 bg-terracotta mx-auto mt-6 rounded-full" />
          </div>

          {types.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              {types.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`px-6 py-2 rounded-full font-bold text-sm transition-all border-2 ${
                    activeType === type
                      ? 'bg-olive border-olive text-white shadow-lg'
                      : 'bg-white border-gray-100 text-gray-400 hover:border-olive hover:text-olive'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}

          <motion.div
            key={activeType}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className="bg-cream p-8 rounded-[40px] shadow-sm border border-olive/5 flex flex-col h-full"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-display font-bold text-ink">{item.name}</h3>
                  <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-olive border border-olive/10">
                    {item.type}
                  </span>
                </div>
                {item.description && (
                  <p className="text-gray-500 text-sm italic mb-6 leading-relaxed">{item.description}</p>
                )}
                <div className="space-y-3">
                  {item.options.map((opt, oIdx) => (
                    <div key={oIdx} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-olive/5 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-olive">{opt.weight}</span>
                        <span className="text-terracotta font-bold text-lg">฿{opt.price}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Cals', value: opt.calories, icon: <Flame size={10} className="text-orange-500" /> },
                          { label: 'Prot', value: `${opt.protein}g`, icon: <Zap size={10} className="text-blue-500" /> },
                          { label: 'Carb', value: `${opt.carbs}g`, icon: <Wheat size={10} className="text-amber-500" /> },
                          { label: 'Fat', value: `${opt.fat}g`, icon: <Droplets size={10} className="text-yellow-600" /> },
                        ].map((stat, i) => (
                          <div key={i} className={`text-center ${i > 0 ? 'border-l border-gray-100' : ''}`}>
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">{stat.label}</div>
                            <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">
                              {stat.icon} {stat.value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          {items.length === 0 && (
            <div className="text-center py-24 bg-cream rounded-[32px] border-2 border-dashed border-gray-100">
              <p className="text-gray-400 italic">Loading menu…</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
