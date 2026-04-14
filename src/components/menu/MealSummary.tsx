import React from 'react';
import { motion, AnimatePresence } from "motion/react";
import { Flame, Zap, Wheat, Droplets, ShoppingCart, Trash2, X } from "lucide-react";

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

interface MealSummaryProps {
  selectedIngredients: SelectedIngredient[];
  mealTotals: {
    price: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  showSummary: boolean;
  setShowSummary: (show: boolean) => void;
  setSelectedIngredients: (ingredients: SelectedIngredient[] | ((prev: SelectedIngredient[]) => SelectedIngredient[])) => void;
}

const MealSummary: React.FC<MealSummaryProps> = React.memo(({
  selectedIngredients,
  mealTotals,
  showSummary,
  setShowSummary,
  setSelectedIngredients
}) => {
  return (
    <>
      <AnimatePresence>
        {selectedIngredients.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-4"
          >
            <div className="bg-ink text-white p-4 sm:p-8 rounded-[32px] sm:rounded-[48px] shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-4 sm:gap-8 border border-white/10 backdrop-blur-xl">
              <div className="flex-1 grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-6 w-full">
                <div className="text-center">
                  <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1 sm:mb-2">Calories</div>
                  <div className="text-sm sm:text-2xl font-bold flex items-center justify-center gap-1 sm:gap-2">
                    <Flame size={12} className="text-orange-500 sm:w-4 sm:h-4" /> {mealTotals.calories}
                  </div>
                </div>
                <div className="text-center border-l border-white/10">
                  <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1 sm:mb-2">Protein</div>
                  <div className="text-sm sm:text-2xl font-bold flex items-center justify-center gap-1 sm:gap-2">
                    <Zap size={12} className="text-blue-500 sm:w-4 sm:h-4" /> {mealTotals.protein}g
                  </div>
                </div>
                <div className="text-center border-l border-white/10">
                  <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1 sm:mb-2">Carbs</div>
                  <div className="text-sm sm:text-2xl font-bold flex items-center justify-center gap-1 sm:gap-2">
                    <Wheat size={12} className="text-amber-500 sm:w-4 sm:h-4" /> {mealTotals.carbs}g
                  </div>
                </div>
                <div className="text-center border-l border-white/10 hidden sm:block">
                  <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest mb-2">Fat</div>
                  <div className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Droplets size={16} className="text-yellow-600" /> {mealTotals.fat}g
                  </div>
                </div>
                <div className="text-center border-l border-white/10">
                  <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold tracking-widest mb-1 sm:mb-2">Total</div>
                  <div className="text-base sm:text-3xl font-bold text-terracotta">฿{mealTotals.price}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-4 w-full lg:w-auto">
                <button 
                  onClick={() => setShowSummary(true)}
                  className="flex-1 lg:flex-none bg-white text-ink px-4 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-sm sm:text-base hover:bg-terracotta hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={18} /> <span className="hidden sm:inline">View Details</span> ({selectedIngredients.length})
                </button>
                <button 
                  onClick={() => setSelectedIngredients([])}
                  className="p-3 sm:p-4 rounded-full bg-white/10 hover:bg-red-500 text-white transition-all"
                  title="Clear All"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm"
            onClick={() => setShowSummary(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[32px] sm:rounded-[48px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 sm:p-10 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-3xl font-display font-bold text-ink">Your Custom Meal</h2>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[8px] sm:text-[10px] mt-1">Ingredient Breakdown</p>
                </div>
                <button 
                  onClick={() => setShowSummary(false)}
                  className="p-2 sm:p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 sm:p-10 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto space-y-3 sm:space-y-4">
                {selectedIngredients.map((si, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 sm:p-6 bg-gray-50 rounded-2xl sm:rounded-3xl border border-gray-100">
                    <div>
                      <h4 className="font-bold text-ink text-sm sm:text-lg">{si.itemName}</h4>
                      <p className="text-olive font-bold text-xs sm:text-sm">{si.weight}</p>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-8">
                      <div className="text-right">
                        <div className="text-terracotta font-bold text-lg sm:text-xl">฿{si.price}</div>
                        <div className="text-[9px] sm:text-[10px] text-gray-400 uppercase font-bold">{si.calories} Cal</div>
                      </div>
                      <button 
                        onClick={() => setSelectedIngredients(prev => (prev as SelectedIngredient[]).filter((_, i) => i !== idx))}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 sm:p-10 bg-ink text-white">
                <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
                  <div className="text-center">
                    <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold mb-1">Calories</div>
                    <div className="font-bold text-base sm:text-xl">{mealTotals.calories}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold mb-1">Protein</div>
                    <div className="font-bold text-base sm:text-xl">{mealTotals.protein}g</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold mb-1">Carbs</div>
                    <div className="font-bold text-base sm:text-xl">{mealTotals.carbs}g</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white/40 text-[8px] sm:text-[10px] uppercase font-bold mb-1">Fat</div>
                    <div className="font-bold text-base sm:text-xl">{mealTotals.fat}g</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-6 sm:pt-8 border-t border-white/10">
                  <span className="text-lg sm:text-2xl font-display font-bold">Total Price</span>
                  <span className="text-2xl sm:text-4xl font-bold text-terracotta">฿{mealTotals.price}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

MealSummary.displayName = 'MealSummary';

export default MealSummary;
