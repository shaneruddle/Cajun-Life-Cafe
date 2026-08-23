import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Salad, Flame, Zap, Wheat, Droplets, Leaf, Candy, Droplet, X } from 'lucide-react';

// Shared nutrition shape — matches the optional fields on MenuItem and the
// (mostly optional, added 2026-08-23) fields on CustomMealOption. All
// optional: undefined/0 means "not entered", never rendered.
export interface NutritionFields {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

type NutritionKey = keyof NutritionFields;

const NUTRITION_ROWS: Array<{ key: NutritionKey; label: string; unit: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }> = [
  { key: 'calories', label: 'Calories', unit: '', icon: Flame, color: 'text-orange-500' },
  { key: 'protein', label: 'Protein', unit: 'g', icon: Zap, color: 'text-blue-500' },
  { key: 'carbs', label: 'Carbs', unit: 'g', icon: Wheat, color: 'text-amber-500' },
  { key: 'fat', label: 'Fat', unit: 'g', icon: Droplets, color: 'text-yellow-600' },
  { key: 'fiber', label: 'Fiber', unit: 'g', icon: Leaf, color: 'text-green-600' },
  { key: 'sugar', label: 'Sugar', unit: 'g', icon: Candy, color: 'text-pink-500' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', icon: Droplet, color: 'text-cyan-600' },
];

// A field counts as "entered" if it's a positive number — 0/undefined/null
// are treated the same as "not measured" so pre-existing Build Your Own
// options (which default calories/protein/carbs/fat to 0) don't trigger a
// popup full of zeroes.
const enteredRows = (n: NutritionFields) =>
  NUTRITION_ROWS.filter(r => typeof n[r.key] === 'number' && (n[r.key] as number) > 0);

export const hasNutritionData = (n?: NutritionFields | null): boolean =>
  !!n && enteredRows(n).length > 0;

interface NutritionButtonProps {
  name: string;
  subtitle?: string;
  nutrition: NutritionFields;
  className?: string;
}

// Small icon button — renders nothing if no nutrition value has been
// entered. Clicking opens a simple popup listing whichever fields have
// values. Stops propagation so it's safe to nest inside a clickable
// card/row without also triggering the parent's own click handler.
const NutritionButton: React.FC<NutritionButtonProps> = ({ name, subtitle, nutrition, className }) => {
  const [open, setOpen] = useState(false);
  const rows = enteredRows(nutrition);

  if (rows.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Nutrition info"
        aria-label={`View nutrition information for ${name}`}
        className={className ?? 'inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-md text-olive hover:bg-white transition-colors flex-shrink-0'}
      >
        <Salad size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-display font-bold text-ink leading-tight">{name}</h3>
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px] mt-1">
                    {subtitle ? `Nutrition · ${subtitle}` : 'Nutrition Information'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-all flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-3">
                {rows.map(({ key, label, unit, icon: Icon, color }) => (
                  <div key={key} className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase text-gray-500">
                      <Icon size={14} className={color} /> {label}
                    </span>
                    <span className="font-bold text-ink">{nutrition[key]}{unit}</span>
                  </div>
                ))}
              </div>
              <p className="px-6 pb-6 text-[10px] text-gray-400 italic">Per serving. Provided for reference only.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NutritionButton;
