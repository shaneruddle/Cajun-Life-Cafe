/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import { 
  MapPin, 
  Phone, 
  Clock, 
  Instagram, 
  Facebook, 
  Menu as MenuIcon, 
  X,
  ChevronRight,
  Globe,
  Settings,
  ArrowLeft,
  Star,
  Quote,
  MessageCircle,
  Flame,
  Zap,
  Wheat,
  Droplets
} from "lucide-react";
import { useState, useEffect, useMemo, FormEvent } from "react";
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate,
  useLocation
} from "react-router-dom";
import { collection, query, where, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { db, auth } from "./firebase";
import { MenuItem, CustomMealItem, CustomMealOption, Category } from "./types";
import { handleFirestoreError } from "./utils/firestore";
import { normalizeImageUrl } from "./utils/images";
// Optimized Sub-components
import MenuItemCard from "./components/menu/MenuItemCard";
import { FirebaseImage } from "./components/ui/FirebaseImage";
import BuildYourOwn from "./components/menu/BuildYourOwn";
import MealSummary from "./components/menu/MealSummary";
import LanguageSwitcher from "./components/menu/LanguageSwitcher";
import MenuItemCardGrid from "./components/menu/MenuItemCardGrid";
import Dashboard from "./components/Dashboard";
import CategoriesDashboard from "./components/CategoriesDashboard";
import CustomMealsDashboard from "./components/CustomMealsDashboard";
import Auth from "./components/Auth";
import BulkImport from "./components/BulkImport";
import BulkCustomMealsImport from "./components/BulkCustomMealsImport";
import DigitalMenu from "./components/DigitalMenu";
import DigitalMenuDisplay from "./components/DigitalMenuDisplay";
import FinanceDashboard from "./components/finance/FinanceDashboard";
import BulkFinanceImport from "./components/finance/BulkFinanceImport";
import ExpenseEntry from "./components/finance/ExpenseEntry";
import DashboardLayout from "./components/DashboardLayout";
import UserManagement from "./components/UserManagement";
import ImageManagement from "./components/ImageManagement";
import SystemLogs from "./components/SystemLogs";
import { fetchPlaceDetails, BusinessInfo } from "./services/googlePlaces";
import { Toaster, toast } from "sonner";

const PLACE_ID = "ChIJ0SjABVyXAjERlZZWVM_TeKE";

const Navbar = ({ isAdmin, businessInfo, setUser }: { isAdmin: boolean, businessInfo: BusinessInfo | null, setUser: (user: any) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname === "/import" || location.pathname === "/import-custom-meals";

  console.log("Navbar Debug - isAdmin:", isAdmin);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`${isDashboard ? "sticky top-0 bg-white border-b border-gray-100 py-3 shadow-sm" : "fixed top-0 w-full transition-all duration-300 " + (scrolled ? "bg-white shadow-md py-3" : "bg-transparent py-6")} z-50 w-full`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <Link to="/" className="flex items-center">
          <div className="bg-white p-1.5 rounded-full shadow-md border border-gray-100">
            <FirebaseImage 
              src={normalizeImageUrl("/logo.png")} 
              alt="Cajun Life Cafe Logo" 
              className="h-10 w-10 rounded-full object-cover"
            />
          </div>
        </Link>
        
        <div className="hidden lg:flex space-x-8 items-center">
          {!isDashboard ? (
            <>
              {["Menu", "About", "Location"].map((item) => (
                <a 
                  key={item} 
                  href={`#${item.toLowerCase()}`} 
                  className={`font-medium hover:text-terracotta transition-colors ${scrolled ? "text-ink" : "text-white"}`}
                >
                  {item}
                </a>
              ))}
              {isAdmin && (
                <Link 
              to="/dashboard" 
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${scrolled ? "bg-cream text-olive hover:bg-olive hover:text-white" : "bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"}`}
            >
              <Settings size={16} /> Dashboard
            </Link>
          )}
          <button className="terracotta-button text-sm">Order Online</button>
          <Auth onUserChange={setUser} />
        </>
      ) : (
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm bg-cream text-olive hover:bg-olive hover:text-white transition-all"
          >
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

  {/* Mobile Menu */}
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="lg:hidden bg-white absolute top-full left-0 w-full shadow-xl p-6 flex flex-col space-y-4"
      >
        {!isDashboard ? (
          <>
            {["Menu", "About", "Location"].map((item) => (
              <a 
                key={item} 
                href={`#${item.toLowerCase()}`} 
                className="text-lg font-medium text-ink"
                onClick={() => setIsOpen(false)}
              >
                {item}
              </a>
            ))}
            <Auth onUserChange={setUser} />
            {isAdmin && (
              <Link 
                to="/dashboard" 
                className="flex items-center gap-2 text-lg font-medium text-olive"
                onClick={() => setIsOpen(false)}
              >
                <Settings size={18} /> Dashboard
              </Link>
            )}
          </>
        ) : (
          <Link 
            to="/" 
            className="flex items-center gap-2 text-lg font-medium text-olive"
            onClick={() => setIsOpen(false)}
          >
            <ArrowLeft size={18} /> Back to Site
          </Link>
        )}
      </motion.div>
    )}
  </AnimatePresence>
</nav>
);
};

const Hero = ({ businessInfo }: { businessInfo: BusinessInfo | null }) => {
  const heroImage = "gs://cajun-life-cafe.firebasestorage.app/assets/hero_image.webp";

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-cream">
      <div className="absolute inset-0 z-0">
        <div className="relative w-full h-full">
          <FirebaseImage 
            src={normalizeImageUrl(heroImage)} 
            alt="Cajun Food" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-col items-center"
            >
              <h1 className="text-5xl md:text-8xl font-display font-bold text-white mb-6 drop-shadow-2xl">
                {businessInfo?.name || "Cajun Life Cafe"}
              </h1>
              <p className="text-xl md:text-2xl text-white/90 font-medium italic tracking-widest uppercase drop-shadow-lg">
                Authentic Louisiana & Thai Soul Food
              </p>
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
    gumbo: "/menu/Cajun-gumbo-with-chicken-sauseage-and-shrimp.jpg", 
    shrimp: "/menu/cajun-fried-shrimp-plate.jpg" 
  };

return (
<section id="about" className="py-24 px-6 bg-white overflow-hidden">
  <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
    >
      <h2 className="text-4xl md:text-5xl font-display font-bold mb-2 text-terracotta">Cajun Life Café</h2>
      <h3 className="text-2xl font-serif italic text-olive mb-8">Where Healthy Tastes Good</h3>
      <p className="text-lg text-gray-600 mb-6 leading-relaxed">
        Our healthy meals are cooked with fresh and clean ingredients that are infused with the flavors that embody the traditional taste of Cajun and Creole Cuisine that creates a rich bold taste.
      </p>
      <p className="text-lg text-gray-600 mb-8 leading-relaxed">
        Cajun Food is a robust, rustic food found along the bayous of Louisiana, a combination of Southern cuisines. “Rustic Cuisine”, meaning that is based on locally available ingredients. Cajun Food is not always spicy, BUT IT ALWAYS HAS SPICE. When it is spicy, it should never be so hot that it overpowers the flavor. Instead, the Cajun “Holy Trinity”, of onions, celery and bell pepper contribute to the flavor along with spices like salt, pepper and cayenne.
      </p>
      <div className="grid grid-cols-3 gap-8">
        <div className="text-center">
          <div className="text-3xl font-bold text-terracotta mb-1">5+</div>
          <div className="text-sm uppercase tracking-wider text-gray-400">Years</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-terracotta mb-1">50+</div>
          <div className="text-sm uppercase tracking-wider text-gray-400">Recipes</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-terracotta mb-1">10k+</div>
          <div className="text-sm uppercase tracking-wider text-gray-400">Happy Guests</div>
        </div>
      </div>
    </motion.div>
    
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 min-h-[400px]">
        <motion.div
          whileHover={{ scale: 1.05, rotate: -2 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative"
        >
          <FirebaseImage 
            src={normalizeImageUrl(images.shrimp)} 
            alt="Cajun Fried Shrimp" 
            className="pill-image mt-12 w-full bg-gray-100 shadow-xl border-4 border-white"
          />
        </motion.div>
        
        <motion.div
          whileHover={{ scale: 1.05, rotate: 2 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative"
        >
          <FirebaseImage 
            src={normalizeImageUrl(images.gumbo)} 
            alt="Cajun Gumbo" 
            className="pill-image w-full bg-gray-100 shadow-xl border-4 border-white"
          />
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

type Language = 'en' | 'zh' | 'ru' | 'th';

const Menu = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("Smoothie Bowls");
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategoryList(cats);
    }, (err) => {
      handleFirestoreError(err, 'list', 'categories');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "menu"), 
      where("published", "==", true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menuItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      
      // Sort in memory to avoid needing a composite index
      const sortedItems = menuItems.sort((a, b) => (a.order || 0) - (b.order || 0));
      
      setItems(sortedItems);
      if (sortedItems.length > 0 && !activeCategory) {
        // Find the first category from the ordered list that has items
        const firstCat = categoryList.length > 0 
          ? categoryList.find(c => sortedItems.some(i => i.category === c.name))?.name || sortedItems[0].category
          : sortedItems[0].category;
        setActiveCategory(firstCat);
      }
    }, (err) => {
      handleFirestoreError(err, 'list', 'menu');
    });
    return () => unsubscribe();
  }, [categoryList]);

  const categories = useMemo(() => {
    if (categoryList.length > 0) {
      return categoryList.map(c => c.name);
    }
    const cats = Array.from(new Set<string>(items.map(item => item.category)));
    return cats.sort();
  }, [items, categoryList]);

const filteredItems = useMemo(() => {
return items.filter(item => item.category === activeCategory);
}, [items, activeCategory]);

const getLocalizedName = (item: MenuItem) => {
switch (language) {
  case 'zh': return item.name_chinese || item.name;
  case 'ru': return item.name_russian || item.name;
  case 'th': return item.name_thai || item.name;
  default: return item.name;
}
};

const getLocalizedDesc = (item: MenuItem) => {
switch (language) {
  case 'zh': return item.description_chinese || item.description;
  case 'ru': return item.description_russian || item.description;
  case 'th': return item.description_thai || item.description;
  default: return item.description;
}
};

const renderPrice = (item: MenuItem) => {
  let prices = item.price.split('/');
  
  // If no slashes in primary price, check for separate fields
  if (prices.length === 1) {
    const extraPrices = [item.price2, item.price3, item.price4].filter(p => p && p.trim() !== '');
    if (extraPrices.length > 0) {
      prices = [item.price, ...extraPrices];
    }
  }

  const desc = getLocalizedDesc(item);
  const proteins = desc.split('/');

  if (prices.length > 1) {
    // Determine labels
    let labels: string[] = [];
    if (proteins.length === prices.length + 1) {
      // Format: Description / Label 1 / Label 2
      labels = proteins.slice(1);
    } else if (proteins.length === prices.length) {
      // Format: Label 1 / Label 2
      labels = proteins;
    } else {
      // Fallback: use labels from description if available, otherwise generic
      labels = prices.map((_, i) => proteins[i] || `Option ${i + 1}`);
    }

    return (
      <div className="space-y-1 mt-3 pt-3 border-t border-gray-50">
        {prices.map((p, i) => (
          <div key={i} className="flex justify-between items-center text-sm">
            <span className="text-gray-500 font-medium">{labels[i]?.trim() || `Option ${i + 1}`}</span>
            <span className="text-terracotta font-bold">฿{p.trim()}</span>
          </div>
        ))}
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
        <p className="text-lg text-gray-600 italic">
          A curated selection of Louisiana and Thai favorites, prepared with love and tradition.
        </p>
      </div>
      
      <div className="flex bg-white p-1 rounded-full shadow-sm border border-gray-100">
        {[
          { code: 'en', label: 'EN' },
          { code: 'zh', label: '中文' },
          { code: 'ru', label: 'RU' },
          { code: 'th', label: 'TH' }
        ].map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code as Language)}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              language === lang.code 
              ? "bg-terracotta text-white shadow-md" 
              : "text-gray-400 hover:text-ink"
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap justify-center gap-4 mb-12">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setActiveCategory(cat)}
          className={`px-6 py-2 rounded-full font-medium transition-all ${
            activeCategory === cat 
            ? "bg-terracotta text-white shadow-lg" 
            : "bg-white text-ink hover:bg-gray-100"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>

    <motion.div 
      key={activeCategory + language}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid md:grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-16"
    >
      {filteredItems.map((item, idx) => (
        <MenuItemCard
          key={item.id || idx}
          item={item}
          language={language}
          getLocalizedName={getLocalizedName}
          getLocalizedDesc={getLocalizedDesc}
          renderPrice={renderPrice}
        />
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

const Location = ({ businessInfo }: { businessInfo: BusinessInfo | null }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  
  return (
<section id="location" className="py-24 px-6 bg-white">
  <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="rounded-[32px] overflow-hidden h-[500px] shadow-xl relative"
    >
      {apiKey ? (
        <iframe
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=place_id:${PLACE_ID}`}
        ></iframe>
      ) : (
        <div className="absolute inset-0 bg-terracotta/10 flex items-center justify-center">
          <div className="bg-white p-6 rounded-2xl shadow-2xl text-center max-w-xs">
            <MapPin className="mx-auto text-terracotta mb-4" size={32} />
            <h3 className="font-bold text-lg mb-2">Find Us Here</h3>
            <p className="text-gray-600 text-sm">{businessInfo?.address || "123 Cajun Lane, New Orleans, LA 70112"}</p>
          </div>
        </div>
      )}
    </motion.div>

    <motion.div
      initial={{ opacity: 0, x: 50 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
    >
      <h2 className="text-4xl md:text-5xl font-display font-bold mb-8">Visit Us</h2>
      
      <div className="space-y-8">
        <div className="flex items-start gap-4">
          <div className="bg-cream p-3 rounded-full text-terracotta">
            <MapPin size={24} />
          </div>
          <div>
            <h4 className="font-bold text-lg mb-1 text-ink">Address</h4>
            <p className="text-gray-600">{businessInfo?.address || "123 Cajun Lane, New Orleans, LA 70112"}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-cream p-3 rounded-full text-terracotta">
            <Phone size={24} />
          </div>
          <div>
            <h4 className="font-bold text-lg mb-1 text-ink">Phone</h4>
            <p className="text-gray-600">{businessInfo?.phone || "(504) 555-0123"}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="bg-cream p-3 rounded-full text-terracotta">
            <Clock size={24} />
          </div>
          <div>
            <h4 className="font-bold text-lg mb-1 text-ink">Hours</h4>
            <div className="text-gray-600 space-y-1">
              {businessInfo?.hours.length ? (
                businessInfo.hours.map((h, i) => <p key={i}>{h}</p>)
              ) : (
                <>
                  <p>Mon - Thu: 11:00 AM - 9:00 PM</p>
                  <p>Fri - Sat: 11:00 AM - 10:00 PM</p>
                  <p>Sun: 10:00 AM - 8:00 PM (Brunch available)</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 flex gap-4">
        <a href={businessInfo?.url || "#"} target="_blank" rel="noopener noreferrer" className="bg-cream p-4 rounded-full text-olive hover:bg-olive hover:text-white transition-all">
          <Instagram size={24} />
        </a>
        <a href={businessInfo?.url || "#"} target="_blank" rel="noopener noreferrer" className="bg-cream p-4 rounded-full text-olive hover:bg-olive hover:text-white transition-all">
          <Facebook size={24} />
        </a>
      </div>
    </motion.div>
  </div>
</section>
);
};

const Footer = ({ businessInfo }: { businessInfo: BusinessInfo | null }) => {
  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState),
      });
      if (!response.ok) throw new Error('Failed to send message');
      setSubmitted(true);
      toast.success("Thank you very much for getting in touch, I will get back to you as soon as possible. Thank you! Cajun Life Cafe");
      setFormState({ name: '', email: '', message: '' });
      setTimeout(() => setSubmitted(false), 5000);
    } catch (error) {
      console.error("Error sending contact form:", error instanceof Error ? error.message : 'Unknown error');
      toast.error("Failed to send message. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
<footer className="bg-ink text-white py-16 px-6">
  <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12">
    <div className="col-span-2">
      <h3 className="text-3xl font-display font-bold mb-6">{businessInfo?.name || "Cajun Life Cafe"}</h3>
      <p className="text-gray-400 max-w-sm mb-8">
        Bringing the authentic heart and soul of Louisiana cooking to your neighborhood. Join us for a taste of the bayou.
      </p>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          <a href="https://www.instagram.com/cajunlifecafe" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <Instagram size={24} />
          </a>
          <a href="https://www.facebook.com/cajunlifecafe" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
            <Facebook size={24} />
          </a>
        </div>
        <a href="tel:0863720084" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2">
          <Phone size={16} /> 086 372 0084
        </a>
      </div>
    </div>

    <div>
      <h4 className="font-bold mb-6 text-terracotta uppercase tracking-wider text-sm">Quick Links</h4>
      <ul className="space-y-4 text-gray-400">
        <li><a href="#menu" className="hover:text-white transition-colors">Menu</a></li>
        <li><a href="https://cajun-life-cafe-852341607813.us-west1.run.app/digital-menu" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Digital Menu</a></li>
        <li><a href="#about" className="hover:text-white transition-colors">Our Story</a></li>
        <li><a href="#location" className="hover:text-white transition-colors">Location</a></li>
        <li><a href={businessInfo?.url || "#"} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Google Maps</a></li>
      </ul>
    </div>

    <div>
      <h4 className="font-bold mb-6 text-terracotta uppercase tracking-wider text-sm">Get in Touch</h4>
      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div 
            key="success-message"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 bg-terracotta/10 border border-terracotta/20 rounded-xl text-center"
          >
            <div className="w-10 h-10 bg-terracotta/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-5 h-5 text-terracotta" />
            </div>
            <p className="text-sm text-gray-300 font-light leading-relaxed mb-4">
              Thank you very much for getting in touch, I will get back to you as soon as possible. Thank you!
            </p>
            <button 
              onClick={() => setSubmitted(false)}
              className="text-[10px] uppercase tracking-widest font-bold text-terracotta hover:text-white transition-colors"
            >
              Send another message
            </button>
          </motion.div>
        ) : (
          <motion.form 
            key="contact-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3" 
            onSubmit={handleFormSubmit}
          >
            <input 
              name="name"
              type="text" 
              placeholder="Name" 
              value={formState.name}
              onChange={(e) => setFormState({...formState, name: e.target.value})}
              className="bg-gray-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-terracotta outline-none"
              required
            />
            <input 
              name="email"
              type="email" 
              placeholder="Email" 
              value={formState.email}
              onChange={(e) => setFormState({...formState, email: e.target.value})}
              className="bg-gray-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-terracotta outline-none"
              required
            />
            <textarea 
              name="message"
              placeholder="Message" 
              rows={3}
              value={formState.message}
              onChange={(e) => setFormState({...formState, message: e.target.value})}
              className="bg-gray-800 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-terracotta outline-none resize-none"
              required
            ></textarea>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="terracotta-button text-sm py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  </div>
  
  <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
    <p>&copy; {new Date().getFullYear()} {businessInfo?.name || "Cajun Life Cafe"}. All rights reserved.</p>
  </div>
</footer>
);
};

const CustomMeals = () => {
  const [items, setItems] = useState<CustomMealItem[]>([]);
  const [activeType, setActiveType] = useState<string>("Protein");

  useEffect(() => {
    const q = query(collection(db, "custom_meals"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mealItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomMealItem[];
      setItems(mealItems);
      if (mealItems.length > 0 && !activeType) {
        setActiveType(mealItems[0].type);
      }
    }, (err) => {
      handleFirestoreError(err, 'list', 'custom_meals');
    });
    return () => unsubscribe();
  }, []);

  const types = useMemo(() => {
    const t = Array.from(new Set(items.map(item => item.type)));
    return t.sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => item.type === activeType);
  }, [items, activeType]);

  return (
    <section id="custom-meals" className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">Build Your Own Meal</h2>
          <p className="text-lg text-gray-600 italic max-w-2xl mx-auto">
            Choose your favorite ingredients and build a meal that fits your macros perfectly.
          </p>
          <div className="h-1 w-24 bg-terracotta mx-auto mt-6 rounded-full"></div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all border-2 ${
                activeType === type 
                ? "bg-olive border-olive text-white shadow-lg" 
                : "bg-white border-gray-100 text-gray-400 hover:border-olive hover:text-olive"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <motion.div 
          key={activeType}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {filteredItems.map((item, idx) => (
            <div key={item.id || idx} className="bg-cream p-8 rounded-[40px] shadow-sm border border-olive/5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-display font-bold text-ink">{item.name}</h3>
                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-olive border border-olive/10">
                  {item.type}
                </span>
              </div>
              
              {item.description && (
                <p className="text-gray-500 text-sm italic mb-6 leading-relaxed">
                  {item.description}
                </p>
              )}

              <div className="space-y-3">
                {item.options.map((opt, oIdx) => (
                  <div key={oIdx} className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl border border-olive/5 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-olive">{opt.weight}</span>
                      <span className="text-terracotta font-bold text-lg">฿{opt.price}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Cals</div>
                        <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">
                          <Flame size={10} className="text-orange-500" /> {opt.calories}
                        </div>
                      </div>
                      <div className="text-center border-l border-gray-100">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Prot</div>
                        <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">
                          <Zap size={10} className="text-blue-500" /> {opt.protein}g
                        </div>
                      </div>
                      <div className="text-center border-l border-gray-100">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Carb</div>
                        <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">
                          <Wheat size={10} className="text-amber-500" /> {opt.carbs}g
                        </div>
                      </div>
                      <div className="text-center border-l border-gray-100">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Fat</div>
                        <div className="text-xs font-bold text-ink flex items-center justify-center gap-1">
                          <Droplets size={10} className="text-yellow-600" /> {opt.fat}g
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>

        {filteredItems.length === 0 && (
          <div className="text-center py-24 bg-cream rounded-[40px] border-2 border-dashed border-olive/10">
            <p className="text-gray-400 italic">No ingredients found in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
};

const Reviews = ({ businessInfo }: { businessInfo: BusinessInfo | null }) => {
  if (!businessInfo?.reviews?.length) return null;

  return (
    <section className="py-24 px-6 bg-cream overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">What Our Guests Say</h2>
          <div className="flex items-center justify-center gap-2 text-terracotta mb-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={20} fill={i < Math.ceil(businessInfo.rating) ? "currentColor" : "none"} />
              ))}
            </div>
            <span className="font-bold text-lg">{businessInfo.rating}</span>
            <span className="text-gray-400">({businessInfo.user_ratings_total} reviews)</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {businessInfo.reviews.slice(0, 3).map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-[32px] shadow-sm relative"
            >
              <Quote className="absolute top-6 right-8 text-cream" size={48} />
              <div className="flex items-center gap-4 mb-6">
                <FirebaseImage 
                  src={review.profile_photo_url} 
                  alt={review.author_name} 
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <h4 className="font-bold text-ink">{review.author_name}</h4>
                  <p className="text-xs text-gray-400">{review.relative_time_description}</p>
                </div>
              </div>
              <div className="flex text-terracotta mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} />
                ))}
              </div>
              <p className="text-gray-600 italic text-sm leading-relaxed">
                "{review.text.length > 200 ? review.text.substring(0, 200) + '...' : review.text}"
              </p>
            </motion.div>
          ))}
        </div>
        
        <div className="text-center mt-12">
          <a 
            href={businessInfo.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-terracotta font-bold hover:underline"
          >
            Read more reviews on Google <ChevronRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
};

const MainSite = ({ isAdmin, businessInfo }: { isAdmin: boolean, businessInfo: BusinessInfo | null }) => (
<div className="min-h-screen">
<Hero businessInfo={businessInfo} />
<About />
<Menu />
<CustomMeals />
<Reviews businessInfo={businessInfo} />
<Location businessInfo={businessInfo} />
<Footer businessInfo={businessInfo} />
</div>
);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Router>
      <Toaster position="top-center" richColors />
      <AppContent 
        user={user} 
        setUser={setUser} 
        businessInfo={businessInfo} 
        setBusinessInfo={setBusinessInfo} 
        error={error} 
        setError={setError} 
      />
    </Router>
  );
}

function AppContent({ user, setUser, businessInfo, setBusinessInfo, error, setError }: any) {
  const location = useLocation();
  const isDigitalMenu = location.pathname === "/menu" || location.pathname === "/digital-menu";
  const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname === "/import" || location.pathname === "/import-custom-meals";
  const isStaffApp = location.pathname === "/expense";

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const isHardcodedAdmin = user.email?.toLowerCase() === "info@cajunlifecafe.com";
    const hasAdminRole = user.role === 'admin';
    
    console.log("Auth Debug - User:", user.email, "Role:", user.role, "Verified:", user.emailVerified);
    console.log("Auth Debug - isAdmin:", isHardcodedAdmin || hasAdminRole);
    
    return isHardcodedAdmin || hasAdminRole;
  }, [user]);

  const isStaff = useMemo(() => {
    return isAdmin || ['manager', 'staff', 'cashier'].includes(user?.role || '');
  }, [user, isAdmin]);

  const isCashierOnly = useMemo(() => {
    return user?.role === 'cashier';
  }, [user]);

  const navigate = useNavigate();

  useEffect(() => {
    if (user && isCashierOnly && !isStaffApp) {
      navigate("/expense");
    }
  }, [user, isCashierOnly, isStaffApp, navigate]);

  useEffect(() => {
    fetchPlaceDetails(PLACE_ID)
      .then((info) => {
        if (info) {
          setBusinessInfo(info);
          setError(null);
        } else {
          setError("Could not fetch business details. Please check your API key configuration.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch business info:", err);
        setError(err.message || "An unexpected error occurred while fetching business details.");
      });
  }, []);

  return (
    <div className="min-h-screen">
      {!isDigitalMenu && !isDashboard && !isStaffApp && <Navbar isAdmin={isAdmin} businessInfo={businessInfo} setUser={setUser} />}
      {isAdmin && error && !isDigitalMenu && (
        <div className="pt-24 px-6">
          <div className="max-w-7xl mx-auto bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <Settings size={16} />
            <span><strong>Admin Notice:</strong> {error}</span>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={isCashierOnly ? <div className="h-screen bg-cream flex items-center justify-center">Redirecting to Staff Portal...</div> : <MainSite isAdmin={isAdmin} businessInfo={businessInfo} />} />
        <Route path="/menu" element={isCashierOnly ? <div className="h-screen bg-cream flex items-center justify-center">Access Denied</div> : <DigitalMenu />} />
        <Route path="/digital-menu" element={isCashierOnly ? <div className="h-screen bg-cream flex items-center justify-center">Access Denied</div> : <DigitalMenuDisplay />} />
        <Route path="/expense" element={isStaff ? <ExpenseEntry /> : <div className="pt-32 text-center h-screen bg-cream">Access Denied. Please login with a staff account.</div>} />
        
        {/* Dashboard Routes with Sidebar Layout */}
        <Route path="/dashboard" element={isAdmin ? <DashboardLayout user={user} /> : <div className="pt-32 text-center h-screen bg-cream flex flex-col items-center justify-center gap-4">Access Denied. Please login as admin. <Auth onUserChange={setUser} /></div>}>
          <Route index element={<Dashboard />} />
          <Route path="categories" element={<CategoriesDashboard />} />
          <Route path="custom-meals" element={<CustomMealsDashboard />} />
          <Route path="finance" element={<FinanceDashboard />} />
          <Route path="finance/import" element={<BulkFinanceImport />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="images" element={<ImageManagement />} />
          <Route path="logs" element={<SystemLogs />} />
        </Route>

        <Route path="/import" element={isAdmin ? <BulkImport /> : <div className="pt-32 text-center h-screen bg-cream flex flex-col items-center justify-center gap-4">Access Denied. Please login as admin. <Auth onUserChange={setUser} /></div>} />
        <Route path="/import-custom-meals" element={isAdmin ? <BulkCustomMealsImport /> : <div className="pt-32 text-center h-screen bg-cream flex flex-col items-center justify-center gap-4">Access Denied. Please login as admin. <Auth onUserChange={setUser} /></div>} />
      </Routes>
      {((!isDigitalMenu && !isDashboard && !isStaffApp) || !user) && (
        <div className="fixed bottom-4 right-4 z-[60]">
          <Auth onUserChange={setUser} />
        </div>
      )}
      {isStaffApp && !user && (
        <div className="fixed inset-0 bg-cream z-[100] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 bg-terracotta/10 rounded-full flex items-center justify-center text-terracotta mb-6">
            <Settings size={40} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-2">Staff Portal</h2>
          <p className="text-gray-500 mb-8">Please login to enter expenses</p>
          <Auth onUserChange={setUser} />
        </div>
      )}
    </div>
  );
}
