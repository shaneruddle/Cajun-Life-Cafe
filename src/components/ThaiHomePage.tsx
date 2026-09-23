import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Zap, Sunrise, Truck, Wallet, MapPin, Clock, Phone, MessageCircle } from 'lucide-react';
import { useLanguage } from '../i18n';

// Thai landing page at /th. The English homepage is hard-coded English, so
// Thai searchers ("อาหารคลีน พัทยา", "ร้านอาหารใกล้ฉัน") previously got an
// English result. This page gives Google a real Thai URL to show them, with
// hreflang pointing back to "/" (see src/seo/pageMeta.ts).

const LINE_URL = 'https://line.me/R/ti/p/@cajunlifecafe';
const MAPS_URL = 'https://maps.app.goo.gl/cajunlifecafe';
const PHONE = '086 372 0084';

const HIGHLIGHTS = [
  {
    icon: <Zap size={24} />,
    title: 'อาหารคลีน โปรตีนสูง',
    desc: 'ไม่ใช้น้ำตาลขัดขาว มีตัวเลือกปลอดกลูเตน จัดชาม Build Your Own ได้เอง พร้อมค่าโภชนาการของวัตถุดิบทุกตัว',
    to: '/th/healthy-eating',
    cta: 'อ่านเพิ่มเติม',
  },
  {
    icon: <Sunrise size={24} />,
    title: 'อาหารเช้าทั้งวัน',
    desc: 'อาหารเช้าแบบอังกฤษ แบบอเมริกัน และ Healthy Omega (แซลมอนรมควัน อะโวคาโด ไข่) เสิร์ฟตลอดวัน 8:00–22:00 น.',
    to: '/breakfast',
    cta: 'ดูเมนูอาหารเช้า',
  },
  {
    icon: <Truck size={24} />,
    title: 'Meal Prep ส่งถึงที่พัก',
    desc: 'อาหารคลีนนับมาโครตามที่คุณต้องการ ปรุงสดใหม่และจัดส่งถึงที่พักในพัทยา สั่งง่าย ๆ ทาง LINE',
    to: '/meal-prep',
    cta: 'ดูรายละเอียด',
  },
  {
    icon: <Wallet size={24} />,
    title: 'บัตรสมาชิก รับเพิ่ม 10%',
    desc: 'เติมเงินในกระเป๋าสมาชิกแล้วรับเครดิตเพิ่ม 10% ทุกครั้ง ใช้จ่ายได้เหมือนเงินสด พร้อมแจ้งยอดทาง LINE',
    to: '/loyalty',
    cta: 'สมัครสมาชิก',
  },
];

export default function ThaiHomePage() {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    // Visitors on the Thai page get Thai menu names etc. elsewhere on the site.
    setLanguage('th');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-cream" lang="th">
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
            ร้านอาหารสุขภาพ เขาพระตำหนัก พัทยา
          </span>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-6 leading-tight">
            อาหารคลีน พัทยา
            <br />
            เคจันและอาหารไทยโฮมเมด
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
            Cajun Life Cafe ร้านอาหารคลีนบนเขาพระตำหนัก เสิร์ฟอาหารโปรตีนสูง ไม่ใช้น้ำตาลขัดขาว
            มีตัวเลือกปลอดกลูเตน ปรุงสดจากวัตถุดิบคุณภาพทุกวัน เปิดทุกวัน 8:00–22:00 น.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/digital-menu"
              className="inline-flex items-center gap-2 px-8 py-4 bg-terracotta text-white rounded-full font-bold text-lg hover:bg-terracotta/90 transition-all shadow-xl"
            >
              ดูเมนู
            </Link>
            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all backdrop-blur-sm"
            >
              <MessageCircle size={20} /> สั่งอาหารทาง LINE
            </a>
          </div>
          <Link to="/" className="inline-block mt-8 text-sm text-white/60 hover:text-white underline underline-offset-4">
            English version
          </Link>
        </motion.div>
      </section>

      {/* Highlights */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6">
          {HIGHLIGHTS.map((h, idx) => (
            <motion.div
              key={h.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08 }}
              className="bg-cream rounded-[28px] p-7 border border-gray-100 flex flex-col"
            >
              <div className="w-12 h-12 bg-olive/10 rounded-2xl flex items-center justify-center text-olive mb-5">{h.icon}</div>
              <h2 className="font-bold text-ink text-xl mb-2">{h.title}</h2>
              <p className="text-gray-500 leading-relaxed flex-1">{h.desc}</p>
              <Link to={h.to} className="mt-5 font-bold text-terracotta hover:underline">
                {h.cta} →
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Visit */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-3xl mx-auto bg-white rounded-[32px] p-8 md:p-10 border border-gray-100 shadow-sm">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-ink mb-8 text-center">แวะมาหาเรา</h2>
          <ul className="space-y-5 text-gray-600">
            <li className="flex gap-4">
              <MapPin className="text-terracotta shrink-0 mt-0.5" size={22} />
              <span>352/306-307 ซอยพระตำหนัก 5 เมืองพัทยา ชลบุรี 20150</span>
            </li>
            <li className="flex gap-4">
              <Clock className="text-terracotta shrink-0 mt-0.5" size={22} />
              <span>เปิดทุกวัน 8:00–22:00 น. (อาหารเช้าเสิร์ฟทั้งวัน)</span>
            </li>
            <li className="flex gap-4">
              <Phone className="text-terracotta shrink-0 mt-0.5" size={22} />
              <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="hover:text-terracotta">{PHONE}</a>
            </li>
            <li className="flex gap-4">
              <MessageCircle className="text-terracotta shrink-0 mt-0.5" size={22} />
              <a href={LINE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-terracotta">LINE: @cajunlifecafe</a>
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3 bg-terracotta text-white rounded-full font-bold hover:bg-terracotta/90 transition-all"
            >
              <MapPin size={18} /> เส้นทางบน Google Maps
            </a>
            <a
              href={`tel:${PHONE.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 px-7 py-3 bg-cream text-ink rounded-full font-bold border border-gray-200 hover:bg-gray-50 transition-all"
            >
              <Phone size={18} /> โทรหาเรา
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
