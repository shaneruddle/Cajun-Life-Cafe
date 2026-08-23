import React from 'react';
import { motion } from "motion/react";
import { Flame, Zap, Wheat, Droplets, Plus, Minus } from "lucide-react";
import { CustomMealItem } from '../../types';
import NutritionButton, { hasNutritionData } from './NutritionInfo';

interface BuildYourOwnProps {
  customMealTypes: string[];
  activeCustomType: string;
  setActiveCustomType: (type: string) => void;
  filteredCustomMeals: CustomMealItem[];
  isSelected: (itemId: string, optionIndex: number) => boolean;
  toggleIngredient: (item: CustomMealItem, optionIndex: number) => void;
  isAdminView?: boolean;
}

const BuildYourOwn: React.FC<BuildYourOwnProps> = React.memo(({
  customMealTypes,
  activeCustomType,
  setActiveCustomType,
  filteredCustomMeals,
  isSelected,
  toggleIngredient,
  isAdminView = false
}) => {
  return (
    <div className="flex flex-col gap-12">
      {/* Sub-filters for Custom Meals */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {customMealTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveCustomType(type)}
            className={`px-3 sm:px-6 py-1 sm:py-2 rounded-full text-[10px] sm:text-sm font-bold transition-all border ${
              activeCustomType === type
              ? "bg-olive border-olive text-white shadow-lg"
              : "bg-white border-gray-200 text-gray-400 hover:border-olive hover:text-olive"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
        {filteredCustomMeals.map((item) => (
          <div key={item.id} className="bg-white p-6 sm:p-10 rounded-[32px] sm:rounded-[48px] shadow-xl border border-olive/5 flex flex-col">
            <div className="flex justify-between items-start mb-6 sm:mb-8">
              <h3 className="text-xl sm:text-3xl font-display font-bold text-ink leading-tight">{item.name}</h3>
              <span className="bg-cream px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest text-olive border border-olive/10">
                {item.type}
              </span>
            </div>
            
            {item.description && (
              <p className="text-gray-500 text-xs sm:text-sm italic mb-6 sm:mb-8 leading-relaxed">
                {item.description}
              </p>
            )}
            
            <div className="space-y-3 sm:space-y-4">
              {[...item.options]
                .map((opt, originalIdx) => ({ opt, originalIdx }))
                .sort((a, b) => a.opt.price - b.opt.price)
                .map(({ opt, originalIdx }) => {
                const selected = isSelected(item.id!, originalIdx);
                return (
                  <div
                    key={originalIdx}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleIngredient(item, originalIdx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleIngredient(item, originalIdx);
                      }
                    }}
                    className={`w-full text-left p-4 sm:p-6 rounded-2xl sm:rounded-3xl border transition-all cursor-pointer ${
                      selected
                      ? "bg-terracotta border-terracotta shadow-md ring-2 ring-terracotta/20"
                      : "bg-gray-50 border-gray-100 hover:border-terracotta/30"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3 sm:mb-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm sm:text-lg ${selected ? "text-white" : "text-olive"}`}>{opt.weight}</span>
                        {hasNutritionData(opt) && (
                          <NutritionButton
                            name={`${item.name} (${opt.weight})`}
                            nutrition={opt}
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors flex-shrink-0 ${
                              selected ? "bg-white/20 text-white hover:bg-white/30" : "bg-olive/10 text-olive hover:bg-olive/20"
                            }`}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className={`font-bold text-lg sm:text-2xl ${selected ? "text-white" : "text-terracotta"}`}>฿{opt.price}</span>
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${selected ? "bg-white text-terracotta" : "bg-terracotta text-white"}`}>
                          {selected ? <Minus size={14} /> : <Plus size={14} />}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:gap-3 text-[10px] sm:text-xs">
                      <div className="text-center">
                        <div className={`uppercase font-bold mb-1 ${selected ? "text-white/60" : "text-gray-400"}`}>Cal</div>
                        <div className={`font-bold flex items-center justify-center gap-0.5 sm:gap-1 ${selected ? "text-white" : "text-ink"}`}>
                          <Flame size={10} className={selected ? "text-white" : "text-orange-500"} /> {opt.calories}
                        </div>
                      </div>
                      <div className={`text-center border-l ${selected ? "border-white/20" : "border-gray-200"}`}>
                        <div className={`uppercase font-bold mb-1 ${selected ? "text-white/60" : "text-gray-400"}`}>Prot</div>
                        <div className={`font-bold flex items-center justify-center gap-0.5 sm:gap-1 ${selected ? "text-white" : "text-ink"}`}>
                          <Zap size={10} className={selected ? "text-white" : "text-blue-500"} /> {opt.protein}g
                        </div>
                      </div>
                      <div className={`text-center border-l ${selected ? "border-white/20" : "border-gray-200"}`}>
                        <div className={`uppercase font-bold mb-1 ${selected ? "text-white/60" : "text-gray-400"}`}>Carb</div>
                        <div className={`font-bold flex items-center justify-center gap-0.5 sm:gap-1 ${selected ? "text-white" : "text-ink"}`}>
                          <Wheat size={10} className={selected ? "text-white" : "text-amber-500"} /> {opt.carbs}g
                        </div>
                      </div>
                      <div className={`text-center border-l ${selected ? "border-white/20" : "border-gray-200"}`}>
                        <div className={`uppercase font-bold mb-1 ${selected ? "text-white/60" : "text-gray-400"}`}>Fat</div>
                        <div className={`font-bold flex items-center justify-center gap-0.5 sm:gap-1 ${selected ? "text-white" : "text-ink"}`}>
                          <Droplets size={10} className={selected ? "text-white" : "text-yellow-600"} /> {opt.fat}g
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

BuildYourOwn.displayName = 'BuildYourOwn';

export default BuildYourOwn;
