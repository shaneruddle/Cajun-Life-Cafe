/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Phone,
  Clock,
  Instagram,
  Facebook,
  Menu as MenuIcon,
  X,
  Settings,
  ArrowLeft,
  Flame,
  Zap,
  Wheat,
  Droplets,
  LogOut,
  Users,
  MessageCircle,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  Navigate,
} from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "./firebase";
import { MenuItem, CustomMealItem, Category } from "./types";
import { handleFirestoreError } from "./utils/firestore";
import { normalizeImageUrl } from "./utils/images";
import MenuItemCard from "./components/menu/MenuItemCard";
import { FirebaseImage } from "./components/ui/FirebaseImage";
import Dashboard from "./components/Dashboard";
import CategoriesDashboard from "./components/CategoriesDashboard";
import CustomMealsDashboard from "./components/CustomMealsDashboard";
import Auth from "./components/Auth";
import BulkImport from "./components/BulkImport";
import BulkCustomMealsImport from "./components/BulkCustomMealsImport";
import DigitalMenuDisplay from "./components/DigitalMenuDisplay";
import DashboardLayout from "./components/DashboardLayout";
import UserManagement from "./components/UserManagement";
import ImageManagement from "./components/ImageManagement";
import SystemLogs from "./components/SystemLogs";
import LoyaltyDashboard from "./components/LoyaltyDashboard";
import CRMDirectory from "./components/CRMDirectory";
import FinanceDashboard from "./components/finance/FinanceDashboard";
import CashierPortal from "./components/CashierPortal";
import { Toaster } from "sonner";
import ActivatePage from "./components/ActivatePage";
import ActivateSuccess from "./components/ActivateSuccess";
import ActivateError from "./components/ActivateError";

const BUSINESS = {
  name: "Cajun Life Cafe",
  address: "352/306-307 Pratumnak Soi 5, Pattaya, Chon Buri",
  phone: "086 372 0084",
  hours: ["Every day: 8:00 AM – 10:00 PM"],
  instagram: "https://www.instagram.com/cajunlifecafe",
  facebook: "https://www.facebook.com/cajunlifecafe",
  line: "https://line.me/R/ti/p/@cajunlifecafe",
  googleMaps: "https://maps.app.goo.gl/cajunlifecafe",
  mapsEmbed: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3888.9527165100435!2d100.85711997507538!3d12.91076058739904!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3102975c05c028d1%3A0xa178d3cf54569695!2sCajun%20Life%20Cafe!5e0!3m2!1sen!2sth!4v1780393736349!5m2!1sen!2sth",
};

type Language = "en" | "zh" | "ru" | "th";

const Navbar = ({
  canAccessDashboard,
  setUser,
}: {
  canAccessDashboard: boolean;
  setUser: (user: any) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isDashboard =
    location.pathname.startsWith("/dashboard") ||
    location.pathname === "/import" ||
    location.pathname === "/import-custom-meals";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`${isDashboard ? "sticky top-0 bg-white border-b border-gray-100 py-3 shadow-sm" : "fixed top-0 w-full transition-all duration-300 " + (scrolled ? "bg-white shadow-md py-3" : "bg-transparent py-6")} z-50 w-full`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center" />
        <div className="hidden lg:flex space-x-8 items-center">
          {!isDashboard ? (
            <>
              {["Menu", "About", "Location"].map((item) => (
                <a key={item} href={`#${item.toLowerCase()}`} className={`font-medium hover:text-terracotta transition-colors ${scrolled ? "text-ink" : "text-white"}`}>{item}</a>
              ))}
              {canAccessDashboard && (
                <Link to="/dashboard" className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${scrolled ? "bg-cream text-olive hover:bg-olive hover:text-white" : "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"}`}>
                  <Settings size={16} /> Dashboard
                </Link>
              )}
              <Auth onUserChange={setUser} />
            </>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm bg-cream text-olive hover:bg-olive hover:text-white transition-all">
                <ArrowLeft size={16} /> Back to Site
              </Link>
              <Auth onUserChange={setUser} />
            </div>
          )}
        </div>
        <button className="lg:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className={scrolled || isDashboard ? "text-ink" : "text-white"} /> : <MenuIcon className={scrolled || isDashboard ? "text-ink" : "text-white"} />}
        </button>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="lg:hidden bg-white absolute top-full left-0 w-full shadow-xl p-6 flex flex-col space-y-4">
            {!isDashboard ? (
              <>
                {["Menu", "About", "Location"].map((item) => (
                  <a key={item} href={`#${item.toLowerCase()}`} className="text-lg font-medium text-ink" onClick={() => setIsOpen(false)}>{item}</a>
                ))}
                <Auth onUserChange={setUser} />
                {canAccessDashboard && (
                  <Link to="/dashboard" className="flex items-center gap-2 text-lg font-medium text-olive" onClick={() => setIsOpen(false)}>
                    <Settings size={18} /> Dashboard
                  </Link>
                )}
              </>
            ) : (
              <Link to="/" className="flex items-center gap-2 text-lg font-medium text-olive" onClick={() => setIsOpen(false)}>
                <ArrowLeft size={18} /> Back to Site
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  const heroImage = "gs://cajun-life-cafe.firebasestorage.app/assets/hero_image.webp";
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-cream">
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full">
          <FirebaseImage src={normalizeImageUrl(heroImage)} alt="Cajun Food" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-6 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }} className="flex flex-col items-center">
              <h1 className="text-5xl md:text-8xl font-display font-bold text-white mb-6 drop-shadow-2xl">{BUSINESS.name}</h1>
              <p className="text-xl md:text-2xl text-white/90 font-medium italic tracking-widest uppercase drop-shadow-lg">Authentic Louisiana & Thai Soul Food</p>
              <div className="mt-12 flex gap-6">
                <a href="#menu" className="terracotta-button px-10 py-4 text-lg">View Menu</a>
                <a href="#location" className="bg-white text-ink hover:bg-cream px-10 py-4 rounded-full font-bold text-lg transition-all shadow-xl">Visit Us</a>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

const About = () => {
  const images = {
    shrimp: "gs://cajun-life-cafe.firebasestorage.app/menu-items/shrimp-etouffee/direct_primary_1778068163771_Shrimp_Etouffee.webp",
    cornbread: "gs://cajun-life-cafe.firebasestorage.app/menu-items/cajun-spicy-cornbread/direct_primary_1778068202432_Cajun_Spicy_Cornbread.webp",
  };

  return (
    <section id="about" className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 text-terracotta">Cajun Life Café</h2>
          <h3 className="text-2xl font-serif italic text-olive mb-8">Where Healthy Tastes Good</h3>
          <p className="text-lg text-gray-600 mb-6 leading-relaxed">Our healthy meals are cooked with fresh and clean ingredients that are infused with the flavors that embody the traditional taste of Cajun and Creole Cuisine that creates a rich bold taste.</p>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">Cajun Food is a robust, rustic food found along the bayous of Louisiana, a combination of Southern cuisines. Cajun Food is not always spicy, BUT IT ALWAYS HAS SPICE. The Cajun "Holy Trinity" of onions, celery and bell pepper contribute to the flavor along with spices like salt, pepper and cayenne.</p>
        </motion.div>

        <div className="relative">
          <div className="grid grid-cols-2 gap-4 min-h-[400px]">
            <motion.div whileHover={{ scale: 1.05, rotate: -2 }} transition={{ type: "spring", stiffness: 300 }} className="relative mt-12">
              <FirebaseImage src={normalizeImageUrl(images.shrimp)} alt="Shrimp Étouffée" className="w-full h-64 object-cover rounded-[2rem] bg-gray-100 shadow-xl border-4 border-white" />
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, rotate: 2 }} transition={{ type: "spring", stiffness: 300 }} className="relative">
              <FirebaseImage src={normalizeImageUrl(images.cornbread)} alt="Cajun Spicy Cornbread" className="w-full h-64 object-cover rounded-[2rem] bg-gray-100 shadow-xl border-4 border-white" />
            </motion.div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-olive rounded-full flex items-center justify-center text-white text-center p-4 transform rotate-12 shadow-xl z-10">
            <span className="font-serif italic text-sm">Authentic & Fresh</span>
          </div>
        </div>
      </div>
    </section>
  );
};

const Menu = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("Smoothie Bowls");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategoryList(cats);
    }, (err) => handleFirestoreError(err, "list", "categories"));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "menu"), where("published", "==", true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menuItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as MenuItem[];
      setItems(menuItems.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (err) => handleFirestoreError(err, "list", "menu"));
    return () => unsubscribe();
  }, [categoryList]);

  const categories = useMemo(() => {
    const cats = categoryList.length > 0 ? categoryList.map((c) => c.name) : Array.from(new Set<string>(items.map((item) => item.category))).sort();
    return cats.filter((cat) => cat !== "More Add Ons");
  }, [items, categoryList]);

  const filteredItems = useMemo(() => items.filter((item) => item.category === activeCategory), [items, activeCategory]);

  const getLocalizedName = (item: MenuItem) => {
    switch (language) {
      case "zh": return item.name_chinese || item.name;
      case "ru": return item.name_russian || item.name;
      case "th": return item.name_thai || item.name;
      default: return item.name;
    }
  };

  const getLocalizedDesc = (item: MenuItem) => {
    switch (language) {
      case "zh": return item.description_chinese || item.description || "";
      case "ru": return item.description_russian || item.description || "";
      case "th": return item.description_thai || item.description || "";
      default: return item.description || "";
    }
  };

  const renderPrice = (item: MenuItem) => {
    const extraPriceData = [
      { price: item.price2, label: item.price2Label },
      { price: item.price3, label: item.price3Label },
      { price: item.price4, label: item.price4Label },
    ].filter((p) => p.price && p.price.trim() !== "");
    if (extraPriceData.length > 0) {
      return (
        <div className="mt-2 pt-2 border-t border-gray-50 text-lg font-black text-terracotta">
          {extraPriceData.map((p) => `${p.label ? p.label.trim() : ""} ฿${p.price!.trim().replace("฿", "")}`.trim()).join(" ")}
        </div>
      );
    }
    return null;
  };

  return (
    <section id="menu" className="py-24 px-6 bg-cream min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-8">
          <div className="text-center md:text-left">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Our Menu</h2>
            <p className="text-lg text-gray-600 italic">A curated selection of Louisiana and Thai favorites, prepared with love and tradition.</p>
          </div>
          <div className="flex bg-white p-1 rounded-full shadow-sm border border-gray-100">
            {[{ code: "en", label: "EN" }, { code: "zh", label: "中文" }, { code: "ru", label: "RU" }, { code: "th", label: "TH" }].map((lang) => (
              <button key={lang.code} onClick={() => setLanguage(lang.code as Language)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${language === lang.code ? "bg-terracotta text-white shadow-md" : "text-gray-400 hover:text-ink"}`}>{lang.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 py-2 rounded-full font-medium transition-all ${activeCategory === cat ? "bg-terracotta text-white shadow-lg" : "bg-white text-ink hover:bg-gray-100"}`}>{cat}</button>
          ))}
        </div>
        <motion.div key={activeCategory + language} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-16">
          {filteredItems.map((item, idx) => (
            <MenuItemCard key={item.id || idx} item={item} language={language} getLocalizedName={getLocalizedName} getLocalizedDesc={getLocalizedDesc} renderPrice={renderPrice} />
          ))}
        </motion.div>
        {filteredItems.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-gray-100">
            <p className="text-gray-400 italic">No items found in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
};

const CustomMeals = () => {
  const [items, setItems] = useState<CustomMealItem[]>([]);
  const [activeType, setActiveType] = useState<string>("Protein");

  useEffect(() => {
    const q = query(collection(db, "custom_meals"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as CustomMealItem[]);
    }, (err) => handleFirestoreError(err, "list", "custom_meals"));
    return () => unsubscribe();
  }, []);

  const types = useMemo(() => Array.from(new Set(items.map((item) => item.type))).sort(), [items]);
  const filteredItems = useMemo(() => items.filter((item) => item.type === activeType), [items, activeType]);

  if (items.length === 0) return null;

  return (
    <section id="custom-meals" className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Build Your Own Meal</h2>
          <p className="text-lg text-gray-600 italic max-w-2xl mx-auto">Choose your favorite ingredients and build a meal that fits your macros perfectly.</p>
          <div className="h-1 w-24 bg-terracotta mx-auto mt-6 rounded-full" />
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {types.map((type) => (
            <button key={type} onClick={() => setActiveType(type)} className={`px-6 py-2 rounded-full font-bold text-sm transition-all border-2 ${activeType === type ? "bg-olive border-olive text-white shadow-lg" : "bg-white border-gray-100 text-gray-400 hover:border-olive hover:text-olive"}`}>{type}</button>
          ))}
        </div>
        <motion.div key={activeType} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredItems.map((item, idx) => (
            <div key={item.id || idx} className="bg-cream p-8 rounded-[40px] shadow-sm border border-olive/5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-display font-bold text-ink">{item.name}</h3>
                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-olive border border-olive/10">{item.type}</span>
              </div>
              {item.description && <p className="text-gray-500 text-sm italic mb-6 leading-relaxed">{item.description}</p>}
              <div className="space-y-3">
                {item.options.map((opt, oIdx) => (
                  <div key={oIdx} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-olive/5 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-olive">{opt.weight}</span>
                      <span className="text-terracotta font-bold text-lg">฿{opt.price}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: "Cals", value: opt.calories, icon: <Flame size={10} className="text-orange-500" /> },
                        { label: "Prot", value: `${opt.protein}g`, icon: <Zap size={10} className="text-blue-500" /> },
                        { label: "Carb", value: `${opt.carbs}g`, icon: <Wheat size={10} className="text-amber-500" /> },
                        { label: "Fat", value: `${opt.fat}g`, icon: <Droplets size={10} className="text-yellow-600" /> },
                      ].map((stat, i) => (
                        <div key={i} className={`text-center ${i > 0 ? "border-l border-gray-100" : ""}`}>
                          <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">{stat.label}</div>
                          <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">{stat.icon} {stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

const Location = () => (
  <section id="location" className="py-24 px-6 bg-white">
    <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="rounded-[32px] overflow-hidden h-[500px] shadow-xl">
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={BUSINESS.mapsEmbed}
        />
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">Visit Us</h2>
        <div className="space-y-8">
          {[
            { icon: <MapPin size={24} />, title: "Address", content: BUSINESS.address },
            { icon: <Phone size={24} />, title: "Phone", content: BUSINESS.phone },
            { icon: <Clock size={24} />, title: "Hours", content: BUSINESS.hours.join("\n") },
          ].map(({ icon, title, content }) => (
            <div key={title} className="flex items-start gap-4">
              <div className="bg-cream p-3 rounded-full text-terracotta">{icon}</div>
              <div>
                <h4 className="font-bold text-lg mb-1 text-ink">{title}</h4>
                <p className="text-gray-600 whitespace-pre-line">{content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-12 flex gap-4">
          <a href={BUSINESS.instagram} target="_blank" rel="noopener noreferrer" className="bg-cream p-4 rounded-full text-olive hover:bg-olive hover:text-white transition-all" title="Instagram">
            <Instagram size={24} />
          </a>
          <a href={BUSINESS.facebook} target="_blank" rel="noopener noreferrer" className="bg-cream p-4 rounded-full text-olive hover:bg-olive hover:text-white transition-all" title="Facebook">
            <Facebook size={24} />
          </a>
          <a href={BUSINESS.line} target="_blank" rel="noopener noreferrer" className="bg-cream p-4 rounded-full text-olive hover:bg-olive hover:text-white transition-all font-bold text-sm flex items-center justify-center w-14 h-14" title="LINE">
            LINE
          </a>
        </div>
      </motion.div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-ink text-white py-16 px-6">
    <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12">
      <div className="col-span-2">
        <h3 className="text-3xl font-display font-bold mb-6">{BUSINESS.name}</h3>
        <p className="text-gray-400 max-w-sm mb-8">Bringing the authentic heart and soul of Louisiana cooking to your neighbourhood. Join us for a taste of the bayou.</p>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <a href={BUSINESS.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors"><Instagram size={24} /></a>
            <a href={BUSINESS.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors"><Facebook size={24} /></a>
            <a href={BUSINESS.line} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors text-sm font-bold flex items-center">LINE</a>
          </div>
          <a href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`} className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <Phone size={16} /> {BUSINESS.phone}
          </a>
          <a href={BUSINESS.line} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            <MessageCircle size={16} /> @cajunlifecafe
          </a>
        </div>
      </div>
      <div>
        <h4 className="font-bold mb-6 text-terracotta uppercase tracking-wider text-sm">Quick Links</h4>
        <ul className="space-y-4 text-gray-400">
          <li><a href="#menu" className="hover:text-white transition-colors">Menu</a></li>
          <li><Link to="/menu" className="hover:text-white transition-colors">Digital Menu</Link></li>
          <li><a href="#about" className="hover:text-white transition-colors">Our Story</a></li>
          <li><a href="#location" className="hover:text-white transition-colors">Location</a></li>
          <li><a href={BUSINESS.line} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">LINE: @cajunlifecafe</a></li>
        </ul>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
      <p>&copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
    </div>
  </footer>
);

const MainSite = ({ isAdmin }: { isAdmin: boolean }) => (
  <div className="min-h-screen">
    <Hero />
    <About />
    <Menu />
    <CustomMeals />
    <Location />
    <Footer />
  </div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  return (
    <Router>
      <Toaster position="top-center" richColors />
      <AppContent user={user} setUser={setUser} />
    </Router>
  );
}

function AppContent({ user, setUser }: any) {
  const location = useLocation();
  const isDigitalMenu = location.pathname === "/menu" || location.pathname === "/digital-menu";
  const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname === "/import" || location.pathname === "/import-custom-meals";

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return user.email?.toLowerCase() === "info@cajunlifecafe.com" || user.role === "admin";
  }, [user]);

  const isMarketing = useMemo(() => isAdmin || user?.role === "marketing", [user, isAdmin]);
  const isManager = useMemo(() => isAdmin || user?.role === "manager", [user, isAdmin]);
  const isCashier = useMemo(() => user?.role === "cashier", [user]);
  const canAccessFinance = useMemo(() => isAdmin || isManager || isCashier, [isAdmin, isManager, isCashier]);
  const isStaff = useMemo(() => isAdmin || ["cashier", "marketing"].includes(user?.role || ""), [user, isAdmin]);
  const isEmployee = useMemo(() => user?.role === "employee", [user]);

  return (
    <div className="min-h-screen">
      {isEmployee && (
        <div className="fixed inset-0 bg-cream z-[200] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center text-terracotta mb-6"><Users size={40} /></div>
          <h2 className="text-2xl font-bold text-ink mb-2">Employee Portal</h2>
          <p className="text-gray-500 mb-8">Your account is pending approval. Please contact an administrator.</p>
          <button onClick={() => signOut(auth)} className="px-8 py-3 bg-terracotta text-white rounded-2xl font-bold hover:bg-terracotta/90 transition-all shadow-lg flex items-center gap-2">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      )}
      {!isDigitalMenu && !isDashboard && !isEmployee && <Navbar canAccessDashboard={isMarketing} setUser={setUser} />}
      <Routes>
        <Route path="/" element={<MainSite isAdmin={isAdmin} />} />
        <Route path="/menu" element={<DigitalMenuDisplay />} />
        <Route path="/digital-menu" element={<DigitalMenuDisplay />} />
        <Route path="/dashboard" element={isAdmin || isMarketing || isStaff ? <DashboardLayout user={user} /> : <div className="pt-32 text-center h-screen bg-cream flex flex-col items-center justify-center gap-4">Access Denied. <Auth onUserChange={setUser} /></div>}>
          <Route index element={isAdmin || isMarketing ? <Dashboard /> : <Navigate to="/dashboard/loyalty" />} />
          <Route path="categories" element={isAdmin || isMarketing ? <CategoriesDashboard /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="custom-meals" element={isAdmin || isMarketing ? <CustomMealsDashboard /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="users" element={isAdmin ? <UserManagement /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="finance" element={canAccessFinance ? <FinanceDashboard user={user} /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="loyalty" element={isAdmin || isStaff ? <LoyaltyDashboard /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="crm" element={isAdmin || isMarketing ? <CRMDirectory /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="images" element={isAdmin || isMarketing ? <ImageManagement /> : <div className="p-20 text-center">Access Denied</div>} />
          <Route path="logs" element={isAdmin ? <SystemLogs /> : <div className="p-20 text-center">Access Denied</div>} />
        </Route>
        <Route path="/import" element={isAdmin || isMarketing ? <BulkImport /> : <div className="pt-32 text-center h-screen bg-cream flex flex-col items-center justify-center gap-4">Access Denied. <Auth onUserChange={setUser} /></div>} />
        <Route path="/cashier" element={<CashierPortal />} />
        <Route path="/import-custom-meals" element={isAdmin || isMarketing ? <BulkCustomMealsImport /> : <div className="pt-32 text-center h-screen bg-cream flex flex-col items-center justify-center gap-4">Access Denied. <Auth onUserChange={setUser} /></div>} />
      <Route path="/activate/:token" element={<ActivatePage />} />
        <Route path="/activate/success" element={<ActivateSuccess />} />
        <Route path="/activate/error" element={<ActivateError />} />
      </Routes>
      {!isDigitalMenu && !isDashboard && !user && (
        <div className="fixed bottom-4 right-4 z-[60]"><Auth onUserChange={setUser} /></div>
      )}
    </div>
  );
}
