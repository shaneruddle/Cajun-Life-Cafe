import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n';
import { motion } from 'motion/react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CustomMealItem, MenuItem } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { hasNutritionData } from './menu/NutritionInfo';
import {
  Flame,
  Zap,
  Wheat,
  Droplets,
  Salad,
  Wheat as GlutenFree,
  Leaf,
  ChevronDown,
} from 'lucide-react';

const PILLARS_EN = [
  {
    icon: <Zap size={26} />,
    title: 'High protein, always',
    desc: 'Every Build Your Own ingredient is published with its protein count — grilled proteins, seafood, and plant options alike — so you can hit your numbers without guessing.',
  },
  {
    icon: <Salad size={26} />,
    title: 'No refined sugar',
    desc: 'Nothing on the menu is built around refined sugar. Sweetness comes from real fruit, not syrup.',
  },
  {
    icon: <GlutenFree size={26} />,
    title: 'Gluten-free options',
    desc: 'Gluten-free choices run across the menu — from Build Your Own bowls to specific dishes — not a single token item.',
  },
  {
    icon: <Leaf size={26} />,
    title: 'Fresh, clean ingredients',
    desc: 'Cooked to order from fresh ingredients, not pre-made and reheated. Home-cooked Cajun and Thai food, made properly.',
  },
];

const FAQS_EN = [
  {
    q: 'Where can I find high-protein food in Pattaya?',
    a: 'Cajun Life Cafe, on Pratumnak Hill, publishes protein counts for every Build Your Own ingredient — grilled chicken, salmon, grass-fed beef, and more — so you can build a meal around your protein target rather than guessing at it.',
  },
  {
    q: 'Is there gluten-free food near Pratumnak Hill?',
    a: 'Yes. Gluten-free options run across the menu at Cajun Life Cafe, not just one token dish, including choices in the Build Your Own bowl builder.',
  },
  {
    q: 'Does Cajun Life Cafe use refined sugar?',
    a: 'No. The menu is built without refined sugar — sweetness in dishes like the smoothie bowls comes from real fruit.',
  },
  {
    q: 'Can I see the nutrition info before I order?',
    a: 'Yes — every Build Your Own ingredient lists calories, protein, carbs, and fat (fiber, sugar, and sodium where measured) right in the menu, both in the cafe on the digital menu and here on this page.',
  },
];

const PILLARS_TH = [
  {
    icon: <Zap size={26} />,
    title: 'โปรตีนสูงทุกจาน',
    desc: 'วัตถุดิบทุกตัวในเมนู Build Your Own แสดงปริมาณโปรตีนชัดเจน ทั้งเนื้อย่าง อาหารทะเล และโปรตีนจากพืช ให้คุณกินได้ตรงเป้าหมายโดยไม่ต้องเดา',
  },
  {
    icon: <Salad size={26} />,
    title: 'ไม่ใช้น้ำตาลขัดขาว',
    desc: 'เมนูของเราไม่ได้ปรุงด้วยน้ำตาลขัดขาว ความหวานมาจากผลไม้จริง ไม่ใช่น้ำเชื่อม',
  },
  {
    icon: <GlutenFree size={26} />,
    title: 'มีตัวเลือกปลอดกลูเตน',
    desc: 'มีเมนูปลอดกลูเตนให้เลือกหลากหลาย ทั้งชาม Build Your Own และเมนูจานหลัก ไม่ใช่แค่จานเดียว',
  },
  {
    icon: <Leaf size={26} />,
    title: 'วัตถุดิบสด สะอาด',
    desc: 'ปรุงสดใหม่ทุกออเดอร์ ไม่ใช่อาหารสำเร็จรูปอุ่นร้อน อาหารเคจันและอาหารไทยแบบโฮมเมดที่ทำอย่างตั้งใจ',
  },
];

const FAQS_TH = [
  {
    q: 'ร้านอาหารคลีนในพัทยาอยู่ที่ไหน?',
    a: 'Cajun Life Cafe อยู่บนเขาพระตำหนัก ซอย 5 พัทยา เสิร์ฟอาหารคลีนโปรตีนสูง ไม่ใช้น้ำตาลขัดขาว พร้อมแสดงค่าโภชนาการของวัตถุดิบทุกตัว เปิดทุกวัน 8:00–22:00 น.',
  },
  {
    q: 'มีอาหารโปรตีนสูงในพัทยาไหม?',
    a: 'มี ที่ Cajun Life Cafe คุณจัดชามเองได้จากอกไก่ย่าง แซลมอน เนื้อวัว และอีกหลายตัวเลือก ทุกตัวเลือกแสดงปริมาณโปรตีนชัดเจน',
  },
  {
    q: 'มีอาหารปลอดกลูเตนแถวพระตำหนักไหม?',
    a: 'มี เรามีเมนูปลอดกลูเตนหลายรายการ รวมถึงตัวเลือกในเมนู Build Your Own',
  },
  {
    q: 'สั่งอาหารคลีนแบบ Meal Prep ส่งถึงที่พักได้ไหม?',
    a: 'ได้ แอดไลน์ @cajunlifecafe เพื่อสั่ง Meal Prep เราปรุงสดใหม่และจัดส่งถึงที่พักของคุณในพัทยา',
  },
];

const COPY = {
  en: {
    pillars: PILLARS_EN,
    faqs: FAQS_EN,
    badge: 'Healthy Eating in Pattaya',
    h1a: 'High protein. No refined sugar.',
    h1b: 'Gluten-free options.',
    intro:
      'Cajun Life Cafe, on Pratumnak Hill in Pattaya, cooks home-style Cajun and Thai food from fresh, clean ingredients — with real nutrition data published for every Build Your Own bowl ingredient, not just marketing copy.',
    ctaMenu: 'See the full menu',
    ctaMealPrep: 'Explore meal prep',
    byNumbers: 'On the menu, by the numbers',
    ingredientsTitle: 'Every Build Your Own ingredient, macro-labeled',
    ingredientsSub:
      'Pick your protein, carbs, and veggies for a bowl or meal-prep plan — every option below lists its real calories, protein, carbs, and fat.',
    all: 'All',
    loading: 'Loading nutrition data…',
    stats: ['Cals', 'Prot', 'Carb', 'Fat'],
    faqTitle: 'Questions people ask',
    ctaTitle: 'Ready to build your bowl?',
    ctaText:
      'Browse the full menu, build a custom bowl, or set up weekly meal prep — all from the same ingredient list you just saw.',
    ctaOrder: 'Order on the Digital Menu',
    ctaLine: 'Message us on LINE',
    switchLabel: 'อ่านหน้านี้เป็นภาษาไทย',
    switchTo: '/th/healthy-eating',
  },
  th: {
    pillars: PILLARS_TH,
    faqs: FAQS_TH,
    badge: 'อาหารคลีน พัทยา',
    h1a: 'โปรตีนสูง ไม่ใช้น้ำตาลขัดขาว',
    h1b: 'มีตัวเลือกปลอดกลูเตน',
    intro:
      'Cajun Life Cafe ร้านอาหารสุขภาพบนเขาพระตำหนัก พัทยา ปรุงอาหารเคจันและอาหารไทยสไตล์โฮมเมดจากวัตถุดิบสดสะอาด พร้อมข้อมูลโภชนาการจริงของวัตถุดิบทุกตัวในเมนู Build Your Own',
    ctaMenu: 'ดูเมนูทั้งหมด',
    ctaMealPrep: 'สั่งอาหารคลีนแบบ Meal Prep',
    byNumbers: 'เมนูพร้อมข้อมูลโภชนาการ',
    ingredientsTitle: 'วัตถุดิบ Build Your Own ทุกตัว พร้อมค่าโภชนาการ',
    ingredientsSub:
      'เลือกโปรตีน คาร์บ และผัก เพื่อจัดชามหรือ Meal Prep ของคุณ ทุกตัวเลือกด้านล่างแสดงแคลอรี่ โปรตีน คาร์บ และไขมันจริง',
    all: 'ทั้งหมด',
    loading: 'กำลังโหลดข้อมูลโภชนาการ…',
    stats: ['แคล', 'โปรตีน', 'คาร์บ', 'ไขมัน'],
    faqTitle: 'คำถามที่พบบ่อย',
    ctaTitle: 'พร้อมจัดชามของคุณหรือยัง?',
    ctaText: 'ดูเมนูทั้งหมด จัดชามเอง หรือสั่ง Meal Prep รายสัปดาห์ ด้วยวัตถุดิบชุดเดียวกับที่คุณเห็นด้านบน',
    ctaOrder: 'ดูเมนูดิจิทัล',
    ctaLine: 'แชทกับเราทาง LINE',
    switchLabel: 'Read this page in English',
    switchTo: '/healthy-eating',
  },
};

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-bold text-ink">{q}</span>
        <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-6 pb-5 text-gray-500 text-sm leading-relaxed">{a}</p>}
    </div>
  );
}

// Rendered in English at /healthy-eating and in Thai at /th/healthy-eating
// (separate URLs so Google can index each language — see src/seo/pageMeta.ts).
export default function HealthyEatingPage({ lang = 'en' }: { lang?: 'en' | 'th' }) {
  const c = COPY[lang];
  const { setLanguage } = useLanguage();
  useEffect(() => {
    if (lang === 'th') setLanguage('th');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  const [ingredients, setIngredients] = useState<CustomMealItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeType, setActiveType] = useState<string>('');

  useEffect(() => {
    const qCustom = query(collection(db, 'custom_meals'), orderBy('order', 'asc'));
    const unsubCustom = onSnapshot(
      qCustom,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CustomMealItem[];
        setIngredients(data);
      },
      (err) => handleFirestoreError(err, 'list', 'custom_meals')
    );

    const qMenu = query(collection(db, 'menu'), orderBy('order', 'asc'));
    const unsubMenu = onSnapshot(
      qMenu,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MenuItem[];
        setMenuItems(data);
      },
      (err) => handleFirestoreError(err, 'list', 'menu')
    );

    return () => {
      unsubCustom();
      unsubMenu();
    };
  }, []);

  // Every Build Your Own ingredient option that has real nutrition data,
  // flattened with its parent ingredient name/type attached.
  const nutritionOptions = useMemo(() => {
    const rows: { name: string; type: string; weight: string; calories: number; protein: number; carbs: number; fat: number }[] = [];
    ingredients.forEach((item) => {
      (item.options || []).forEach((opt) => {
        if (hasNutritionData(opt)) {
          rows.push({ name: item.name, type: item.type, weight: opt.weight, calories: opt.calories, protein: opt.protein, carbs: opt.carbs, fat: opt.fat });
        }
      });
    });
    return rows;
  }, [ingredients]);

  const types = useMemo(() => Array.from(new Set(nutritionOptions.map((r) => r.type))).sort(), [nutritionOptions]);
  const filteredOptions = useMemo(
    () => (activeType ? nutritionOptions.filter((r) => r.type === activeType) : nutritionOptions),
    [nutritionOptions, activeType]
  );

  const publishedNutritionMenuItems = useMemo(
    () => menuItems.filter((m) => m.published !== false && hasNutritionData(m)),
    [menuItems]
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative bg-ink text-white py-28 px-6 overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-olive" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-terracotta" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="inline-block bg-olive/20 text-olive font-bold text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              {c.badge}
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
              {c.h1a}<br />{c.h1b}
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              {c.intro}
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a
                href="/digital-menu"
                className="inline-flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-full font-bold text-lg hover:bg-terracotta/90 transition-all shadow-xl"
              >
                {c.ctaMenu}
              </a>
              <a
                href="/meal-prep"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-sm"
              >
                {c.ctaMealPrep}
              </a>
            </div>
            <Link to={c.switchTo} className="inline-block mt-8 text-sm text-white/60 hover:text-white underline underline-offset-4">
              {c.switchLabel}
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {c.pillars.map(({ icon, title, desc }, idx) => (
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

      {/* On the menu — named dishes with real nutrition data */}
      {publishedNutritionMenuItems.length > 0 && (
        <section className="py-16 px-6 bg-cream">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-ink mb-8 text-center">{c.byNumbers}</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {publishedNutritionMenuItems.map((item) => (
                <div key={item.id} className="bg-white rounded-[28px] p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-ink text-lg mb-1">{item.name}</h3>
                  {item.price && <p className="text-terracotta font-bold mb-4">฿{item.price.replace('฿', '').trim()}</p>}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: c.stats[0], value: item.calories, icon: <Flame size={12} className="text-orange-500" /> },
                      { label: c.stats[1], value: item.protein != null ? `${item.protein}g` : undefined, icon: <Zap size={12} className="text-blue-500" /> },
                      { label: c.stats[2], value: item.carbs != null ? `${item.carbs}g` : undefined, icon: <Wheat size={12} className="text-amber-500" /> },
                      { label: c.stats[3], value: item.fat != null ? `${item.fat}g` : undefined, icon: <Droplets size={12} className="text-yellow-600" /> },
                    ].map((stat, i) => (
                      <div key={i} className={`text-center ${i > 0 ? 'border-l border-gray-100' : ''}`}>
                        <div className="text-[9px] text-gray-400 uppercase font-bold mb-1">{stat.label}</div>
                        <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">
                          {stat.value != null ? <>{stat.icon} {stat.value}</> : <span className="text-gray-300">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Build Your Own — the full macro-transparent ingredient list */}
      <section id="ingredients" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">{c.ingredientsTitle}</h2>
            <p className="text-lg text-gray-600 italic max-w-2xl mx-auto">
              {c.ingredientsSub}
            </p>
            <div className="h-1 w-24 bg-terracotta mx-auto mt-6 rounded-full" />
          </div>

          {types.length > 1 && (
            <div className="flex flex-wrap justify-center gap-3 mb-10">
              <button
                onClick={() => setActiveType('')}
                className={`px-6 py-2 rounded-full font-bold text-sm transition-all border-2 ${
                  activeType === ''
                    ? 'bg-olive border-olive text-white shadow-lg'
                    : 'bg-white border-gray-100 text-gray-400 hover:border-olive hover:text-olive'
                }`}
              >
                {c.all}
              </button>
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

          {filteredOptions.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOptions.map((opt, idx) => (
                <div key={idx} className="bg-cream rounded-2xl p-5 border border-olive/5">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-ink text-sm">{opt.name}</p>
                      <p className="text-gray-400 text-xs">{opt.weight}</p>
                    </div>
                    <span className="bg-white px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest text-olive border border-olive/10">
                      {opt.type}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { label: c.stats[0], value: opt.calories, icon: <Flame size={10} className="text-orange-500" /> },
                      { label: c.stats[1], value: `${opt.protein}g`, icon: <Zap size={10} className="text-blue-500" /> },
                      { label: c.stats[2], value: `${opt.carbs}g`, icon: <Wheat size={10} className="text-amber-500" /> },
                      { label: c.stats[3], value: `${opt.fat}g`, icon: <Droplets size={10} className="text-yellow-600" /> },
                    ].map((stat, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">{stat.label}</div>
                        <div className="text-[11px] font-bold text-ink flex items-center justify-center gap-0.5">
                          {stat.icon} {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-24 bg-cream rounded-[32px] border-2 border-dashed border-gray-100">
              <p className="text-gray-400 italic">{c.loading}</p>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-display font-bold text-ink mb-10 text-center">{c.faqTitle}</h2>
          <div className="space-y-3">
            {c.faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-ink text-white text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold mb-4">{c.ctaTitle}</h2>
        <p className="text-white/70 mb-8 max-w-xl mx-auto">
          {c.ctaText}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="/digital-menu"
            className="inline-flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-full font-bold hover:bg-terracotta/90 transition-all shadow-xl"
          >
            {c.ctaOrder}
          </a>
          <a
            href="https://line.me/R/ti/p/@cajunlifecafe"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-full font-bold hover:bg-white/20 transition-all backdrop-blur-sm"
          >
            {c.ctaLine}
          </a>
        </div>
      </section>
    </div>
  );
}
