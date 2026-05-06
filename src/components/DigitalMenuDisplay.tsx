import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { MenuItem, CustomMealItem, Category } from "../types";
import { handleFirestoreError } from "../utils/firestore";
import { normalizeImageUrl } from "../utils/images";
import { FirebaseImage } from "./ui/FirebaseImage";

// Optimized Sub-components
import MenuItemCard from "./menu/MenuItemCard";
import BuildYourOwn from "./menu/BuildYourOwn";
import MealSummary from "./menu/MealSummary";
import LanguageSwitcher from "./menu/LanguageSwitcher";

type Language = 'en' | 'zh' | 'ru' | 'th';

interface SelectedIngredient {
  itemId: string;
  itemName: string;
  optionIndex: number;
  weight: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const DigitalMenuDisplay = () => {
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [customMeals, setCustomMeals] = useState<CustomMealItem[]>([]);
  const [loading, setLoading] = useState({ menu: true, meals: true });
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [activeCustomType, setActiveCustomType] = useState<string>("All");
  const [language, setLanguage] = useState<Language>('en');
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initialCategorySet = useRef(false);

  const isLoading = loading.menu || loading.meals || (isPreview && authLoading);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, "categories"), orderBy("order", "asc")), (snapshot) => {
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Wait for auth to be determined if in preview mode
    if (isPreview && authLoading) return;

    console.log("Fetching menu items, preview mode:", isPreview, "User:", user?.email);
    
    // If in preview mode, we MUST be an admin. If not logged in, we might get permission denied.
    // However, we'll try the query anyway as Firestore will handle the state.
    const q = isPreview 
      ? query(collection(db, "menu"))
      : query(collection(db, "menu"), where("published", "==", true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Menu snapshot received, docs:", snapshot.size);
      const menuItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      
      const sortedItems = menuItems.sort((a, b) => (a.order || 0) - (b.order || 0));
      setItems(sortedItems);
      
      setLoading(prev => ({ ...prev, menu: false }));
    }, (err) => {
      console.error("Menu snapshot error:", err);
      setLoading(prev => ({ ...prev, menu: false }));
    });
    return () => unsubscribe();
  }, [isPreview, authLoading, user]);

  // Separate effect to handle initial category selection once both items and categoryList are ready
  useEffect(() => {
    if (!initialCategorySet.current && !isLoading && (items.length > 0 || customMeals.length > 0)) {
      if (items.length > 0) {
        const firstCat = categoryList.length > 0 
          ? categoryList.find(c => items.some(i => i.category === c.name))?.name || items[0].category
          : items[0].category;
        setActiveCategory(firstCat);
      } else if (customMeals.length > 0) {
        setActiveCategory("Build Your Own");
      }
      initialCategorySet.current = true;
    }
  }, [items, customMeals, categoryList, isLoading]);

  useEffect(() => {
    console.log("Fetching custom meals");
    const q = query(collection(db, "custom_meals"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("Custom meals snapshot received, docs:", snapshot.size);
      const mealItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomMealItem[];
      setCustomMeals(mealItems);
      setLoading(prev => ({ ...prev, meals: false }));
    }, (err) => {
      console.error("Custom meals snapshot error:", err);
      setLoading(prev => ({ ...prev, meals: false }));
    });
    return () => unsubscribe();
  }, []);

  const categories = useMemo(() => {
    const itemCats = Array.from(new Set<string>(items.map(item => item.category)));
    let cats: string[] = [];
    
    if (categoryList.length > 0) {
      const definedCats = categoryList.map(c => c.name);
      // Include defined categories first, then any other categories found in items
      const otherCats = itemCats.filter(cat => !definedCats.includes(cat)).sort();
      cats = [...definedCats, ...otherCats];
    } else {
      cats = itemCats.sort();
    }

    if (customMeals.length > 0 && !cats.includes("Build Your Own")) {
      cats.push("Build Your Own");
    }
    return cats;
  }, [items, customMeals, categoryList]);

  const filteredItems = useMemo(() => {
    return items.filter(item => item.category === activeCategory);
  }, [items, activeCategory]);

  // Fallback if active category disappears
  useEffect(() => {
    if (activeCategory && categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const customMealTypes = useMemo(() => {
    const types = Array.from(new Set(customMeals.map(item => item.type)));
    return ["All", ...types.sort()];
  }, [customMeals]);

  const filteredCustomMeals = useMemo(() => {
    if (activeCustomType === "All") return customMeals;
    return customMeals.filter(item => item.type === activeCustomType);
  }, [customMeals, activeCustomType]);

  const mealTotals = useMemo(() => {
    return selectedIngredients.reduce((acc, curr) => ({
      price: acc.price + curr.price,
      calories: acc.calories + curr.calories,
      protein: acc.protein + curr.protein,
      carbs: acc.carbs + curr.carbs,
      fat: acc.fat + curr.fat,
    }), { price: 0, calories: 0, protein: 0, carbs: 0, fat: 0 });
  }, [selectedIngredients]);

  const toggleIngredient = useCallback((item: CustomMealItem, optionIndex: number) => {
    const option = item.options[optionIndex];
    const existingIndex = selectedIngredients.findIndex(
      si => si.itemId === item.id && si.optionIndex === optionIndex
    );

    if (existingIndex > -1) {
      setSelectedIngredients(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      setSelectedIngredients(prev => [...prev, {
        itemId: item.id!,
        itemName: item.name,
        optionIndex,
        weight: option.weight,
        price: option.price,
        calories: option.calories,
        protein: option.protein,
        carbs: option.carbs,
        fat: option.fat,
      }]);
    }
  }, [selectedIngredients]);

  const isSelected = useCallback((itemId: string, optionIndex: number) => {
    return selectedIngredients.some(si => si.itemId === itemId && si.optionIndex === optionIndex);
  }, [selectedIngredients]);

  const getLocalizedName = useCallback((item: MenuItem) => {
    switch (language) {
      case 'zh': return item.name_chinese || item.name;
      case 'ru': return item.name_russian || item.name;
      case 'th': return item.name_thai || item.name;
      default: return item.name;
    }
  }, [language]);

  const getLocalizedDesc = useCallback((item: MenuItem) => {
    const englishDesc = item.description || "";
    const englishParts = englishDesc.split('/');
    
    let localizedDesc = "";
    switch (language) {
      case 'zh': localizedDesc = item.description_chinese || ""; break;
      case 'ru': localizedDesc = item.description_russian || ""; break;
      case 'th': localizedDesc = item.description_thai || ""; break;
      default: localizedDesc = englishDesc;
    }

    if (language === 'en' || !localizedDesc) return englishDesc;

    const localizedParts = localizedDesc.split('/');
    
    // If localized has labels, use them. If not, use English labels.
    if (localizedParts.length > 1) {
      return localizedDesc;
    } else {
      // Localized is just a main description, append English labels if they exist
      if (englishParts.length > 1) {
        return [localizedParts[0], ...englishParts.slice(1)].join(' / ');
      }
      return localizedParts[0];
    }
  }, [language]);

  const renderPrice = useCallback((item: MenuItem) => {
    const prices = [item.price, item.price2, item.price3].filter(p => p && p.trim() !== '');
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
        <div className="grid grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-2 pt-4 border-t border-gray-100">
          {prices.map((p, i) => (
            <div key={i} className="flex justify-between text-xs sm:text-sm">
              <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px] sm:text-[10px]">{labels[i]?.trim() || `Option ${i + 1}`}</span>
              <span className="text-terracotta font-bold">฿{p.trim()}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }, [getLocalizedDesc]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-8">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-32 h-32"
        >
          <FirebaseImage 
            src={normalizeImageUrl("/logo.png")} 
            alt="Loading..." 
            className="w-32 h-32 rounded-full object-cover border-4 border-terracotta shadow-xl"
          />
        </motion.div>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 sm:p-6 md:p-8 relative">

      <div className="max-w-6xl mx-auto">
        <header className="mb-8 lg:mb-20 lg:text-center lg:flex lg:flex-col lg:items-center">
          {/* Logo removed as requested */}
          <div className="hidden lg:block">
            <h1 className="text-4xl lg:text-6xl font-display font-bold text-terracotta mb-2">Cajun Life Cafe</h1>
            <p className="text-xs lg:text-sm uppercase tracking-[0.3em] text-gray-400 font-bold">Digital Menu Display</p>
          </div>
        </header>

        <div className="mb-8 lg:mb-12 flex justify-center">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8 lg:mb-20">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 sm:px-8 py-1.5 sm:py-3 rounded-full font-bold text-xs sm:text-lg transition-all border-2 ${
                activeCategory === cat 
                ? "bg-terracotta border-terracotta text-white shadow-xl scale-105" 
                : "bg-white border-gray-100 text-gray-400 hover:border-terracotta hover:text-terracotta"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="min-h-[60vh]">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeCategory + language}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {activeCategory === "Build Your Own" ? (
                <BuildYourOwn 
                  customMealTypes={customMealTypes}
                  activeCustomType={activeCustomType}
                  setActiveCustomType={setActiveCustomType}
                  filteredCustomMeals={filteredCustomMeals}
                  isSelected={isSelected}
                  toggleIngredient={toggleIngredient}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredItems.map((item, index) => (
                    <MenuItemCard 
                      key={item.id}
                      item={item}
                      language={language}
                      getLocalizedName={getLocalizedName}
                      getLocalizedDesc={getLocalizedDesc}
                      renderPrice={renderPrice}
                      priority={index < 4}
                    />
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="col-span-full text-center py-24 bg-white/50 rounded-[40px] border-2 border-dashed border-gray-200">
                      <p className="text-gray-400 italic">No items found in this category.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="mt-32 pt-16 border-t border-gray-200 text-center text-gray-400">
          <p className="text-lg font-display font-bold text-terracotta mb-2">Cajun Life Cafe</p>
          <p className="text-sm">Fresh Ingredients • Authentic Recipes • Made with Love</p>
        </footer>

        <MealSummary 
          selectedIngredients={selectedIngredients}
          mealTotals={mealTotals}
          showSummary={showSummary}
          setShowSummary={setShowSummary}
          setSelectedIngredients={setSelectedIngredients}
        />
      </div>
    </div>
  );
};

export default DigitalMenuDisplay;
