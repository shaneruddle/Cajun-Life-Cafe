import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth , menuDb} from "../firebase";
import { MenuItem, CustomMealItem, Category } from "../types";
import { handleFirestoreError } from "../utils/firestore";
import { normalizeImageUrl } from "../utils/images";
import { FirebaseImage } from "./ui/FirebaseImage";

// Optimized Sub-components
import MenuItemCard from "./menu/MenuItemCard";
import BuildYourOwn from "./menu/BuildYourOwn";
import MealSummary from "./menu/MealSummary";
import LanguageSwitcher from "./menu/LanguageSwitcher";

const SimpleListMember = ({ item, getLocalizedName }: { item: MenuItem; getLocalizedName: (item: MenuItem) => string }) => (
  <div className="flex justify-between items-center py-4 border-b border-gray-100 group hover:bg-cream/50 px-4 rounded-2xl transition-colors bg-white/50 backdrop-blur-sm">
    <span className="font-bold text-ink text-sm sm:text-base">{getLocalizedName(item)}</span>
    <span className="font-black text-terracotta text-sm sm:text-base">฿{item.price?.replace('฿', '').trim()}</span>
  </div>
);

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
    const unsubscribe = onSnapshot(query(collection(menuDb, 'categories'), orderBy("order", "asc")), (snapshot) => {
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
      ? query(collection(menuDb, 'menu'))
      : query(collection(menuDb, 'menu'), where("published", "==", true));

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
    const q = query(collection(menuDb, 'custom_meals'), orderBy("order", "asc"));
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
    switch (language) {
      case 'zh': return item.description_chinese || item.description || "";
      case 'ru': return item.description_russian || item.description || "";
      case 'th': return item.description_thai || item.description || "";
      default: return item.description || "";
    }
  }, [language]);

  const renderPrice = useCallback((item: MenuItem) => {
    const extraPriceData = [
      { price: item.price2, label: item.price2Label },
      { price: item.price3, label: item.price3Label },
      { price: item.price4, label: item.price4Label }
    ].filter(p => p.price && p.price.trim() !== '');

    if (extraPriceData.length === 0) return null;

    const formattedOptions = extraPriceData.map((p) => {
      const labelText = p.label ? p.label.trim() : "";
      const cleanPrice = p.price!.trim().replace('฿', '');
      return `${labelText} ฿${cleanPrice}`.trim();
    });

    return (
      <div className="mt-2 pt-2 border-t border-gray-50 text-lg font-black text-terracotta">
        {formattedOptions.join(' ')}
      </div>
    );
  }, []);

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
    <div className="min-h-screen bg-cream p-1 sm:p-2 relative">

      <div className="max-w-6xl mx-auto">
        <header className="mb-2 lg:mb-4 lg:text-center lg:flex lg:flex-col lg:items-center">
          <div className="hidden lg:block">
            <h1 className="text-3xl lg:text-5xl font-display font-bold text-terracotta">Cajun Life Cafe</h1>
            <p className="text-[10px] lg:text-xs uppercase tracking-[0.3em] text-gray-400 font-bold">Digital Menu Display</p>
          </div>
        </header>

        <div className="mb-2 lg:mb-4 flex justify-center">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
        </div>

        {/* Category Tabs - Sticky Bar */}
        <div className="sticky top-0 z-50 py-3 -mx-1 sm:-mx-2 px-1 sm:px-2 mb-4 lg:mb-8 bg-cream/95 backdrop-blur-md transition-all duration-300 border-b border-gray-100/50">
          <div className="flex overflow-x-auto no-scrollbar scroll-smooth gap-3 px-2 pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`px-6 py-3 rounded-full font-bold text-sm sm:text-base whitespace-nowrap transition-all border-2 flex-shrink-0 ${
                  activeCategory === cat 
                  ? "bg-terracotta border-terracotta text-white shadow-xl shadow-terracotta/20 scale-105" 
                  : "bg-white border-gray-200 text-gray-600 hover:border-terracotta hover:text-terracotta active:scale-95"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[60vh] scroll-mt-32">
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
                <div className={activeCategory === "More Add Ons" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "grid grid-cols-1 lg:grid-cols-2 gap-6"}>
                  {filteredItems.map((item, index) => (
                    activeCategory === "More Add Ons" ? (
                      <SimpleListMember 
                        key={item.id} 
                        item={item} 
                        getLocalizedName={getLocalizedName} 
                      />
                    ) : (
                      <MenuItemCard 
                        key={item.id}
                        item={item}
                        language={language}
                        getLocalizedName={getLocalizedName}
                        getLocalizedDesc={getLocalizedDesc}
                        renderPrice={renderPrice}
                        priority={index < 2}
                      />
                    )
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
