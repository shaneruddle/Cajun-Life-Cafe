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
import MenuItemCardGrid from "./menu/MenuItemCardGrid";
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

const DigitalMenu = () => {
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [customMeals, setCustomMeals] = useState<CustomMealItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [activeCustomType, setActiveCustomType] = useState("All");
  const [language, setLanguage] = useState<Language>('en');
  const [selectedIngredients, setSelectedIngredients] = useState<SelectedIngredient[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState({ menu: true, meals: true });
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const initialCategorySet = useRef(false);

  const isLoading = loading.menu || loading.meals || (isPreview && authLoading);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    // Wait for auth to be determined if in preview mode
    if (isPreview && authLoading) return;

    const q = isPreview 
      ? query(collection(db, "menu"))
      : query(collection(db, "menu"), where("published", "==", true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menuItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      
      // Sort in memory to avoid needing a composite index
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
    const q = query(collection(db, "custom_meals"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    switch (language) {
      case 'zh': return item.description_chinese || item.description;
      case 'ru': return item.description_russian || item.description;
      case 'th': return item.description_thai || item.description;
      default: return item.description;
    }
  }, [language]);

  const renderPrice = useCallback((item: MenuItem) => {
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
    <div className="min-h-screen bg-cream flex flex-col">
      <LanguageSwitcher language={language} setLanguage={setLanguage} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Categories */}
        <aside className="w-64 bg-white border-r border-gray-100 overflow-y-auto p-8 hidden lg:block">
          <div className="mb-10 flex flex-col items-center">
            <FirebaseImage 
              src={normalizeImageUrl("/logo.png")} 
              alt="Cajun Life Cafe Logo" 
              className="w-20 h-20 rounded-full object-cover border-2 border-terracotta shadow-md mb-4"
            />
            <h1 className="text-2xl font-display font-bold text-terracotta mb-1">Cajun Life</h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Menu Display</p>
          </div>
          
          <h2 className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-6">Categories</h2>
          <div className="space-y-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-5 py-3 rounded-2xl font-medium transition-all ${
                  activeCategory === cat 
                  ? "bg-terracotta text-white shadow-md" 
                  : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-12">
          {/* Mobile Categories (Horizontal Scroll) */}
          <div className="lg:hidden flex overflow-x-auto gap-2 sm:gap-3 mb-8 sm:mb-10 pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 sm:px-6 py-2 rounded-full font-medium text-sm sm:text-base transition-all ${
                  activeCategory === cat 
                  ? "bg-terracotta text-white shadow-lg" 
                  : "bg-white text-ink shadow-sm border border-gray-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="mb-8 sm:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-ink">{activeCategory}</h2>
            <div className="h-1 sm:h-1.5 w-16 sm:w-24 bg-terracotta mt-3 sm:mt-4 rounded-full"></div>
          </div>          <motion.div 
            key={activeCategory + language}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8"
          >
            {activeCategory === "Build Your Own" && (
              <div className="flex flex-wrap gap-2">
                {customMealTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveCustomType(type)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      activeCustomType === type
                      ? "bg-olive border-olive text-white shadow-md"
                      : "bg-white border-gray-200 text-gray-400 hover:border-olive hover:text-olive"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6">
              {activeCategory === "Build Your Own" ? (
                <BuildYourOwn 
                  customMealTypes={customMealTypes}
                  activeCustomType={activeCustomType}
                  setActiveCustomType={setActiveCustomType}
                  filteredCustomMeals={filteredCustomMeals}
                  isSelected={isSelected}
                  toggleIngredient={toggleIngredient}
                  isAdminView={true}
                />
              ) : (
                filteredItems.map((item) => (
                  <MenuItemCardGrid 
                    key={item.id}
                    item={item}
                    language={language}
                    getLocalizedName={getLocalizedName}
                    getLocalizedDesc={getLocalizedDesc}
                    renderPrice={renderPrice}
                  />
                ))
              )}
            </div>
          </motion.div>

          {(activeCategory === "Build Your Own" ? filteredCustomMeals.length === 0 : filteredItems.length === 0) && (
            <div className="text-center py-24 bg-white rounded-[32px] border-2 border-dashed border-gray-100">
              <p className="text-gray-400 italic">No items found in this category.</p>
            </div>
          )}
        </main>
      </div>

      <MealSummary 
        selectedIngredients={selectedIngredients}
        mealTotals={mealTotals}
        showSummary={showSummary}
        setShowSummary={setShowSummary}
        setSelectedIngredients={setSelectedIngredients}
      />
    </div>
  );
};

export default DigitalMenu;
