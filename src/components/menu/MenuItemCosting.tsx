import { useState, useEffect } from 'react';
import {
  collection, doc, onSnapshot, query, orderBy,
  setDoc, updateDoc, deleteField,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { MenuItem } from '../../types';
import { X, Plus, Trash2, TrendingUp, TrendingDown, Minus, ChefHat } from 'lucide-react';
import { toast } from 'sonner';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_cost_per_unit?: number;
}

interface RecipeLine {
  ingredient_id: string;
  ingredient_name: string;
  portion_g: number;   // grams (or ml) per serving
  unit: string;
}

// Normalise cost to per-gram or per-ml
function costPerBaseUnit(ing: Ingredient): number | null {
  if (!ing.current_cost_per_unit) return null;
  if (ing.unit === 'kg') return ing.current_cost_per_unit / 1000;
  if (ing.unit === 'l')  return ing.current_cost_per_unit / 1000;
  return ing.current_cost_per_unit;
}

function lineCost(line: RecipeLine, ingMap: Record<string, Ingredient>): number | null {
  const ing = ingMap[line.ingredient_id];
  if (!ing) return null;
  const cpu = costPerBaseUnit(ing);
  if (cpu === null) return null;
  return cpu * line.portion_g;
}

function MarginBadge({ cost, price }: { cost: number; price: number }) {
  const pct = ((price - cost) / price) * 100;
  const cls = pct >= 65 ? 'bg-green-100 text-green-700'
            : pct >= 50 ? 'bg-amber-100 text-amber-700'
            :              'bg-red-100 text-red-700';
  const Icon = pct >= 65 ? TrendingUp : pct >= 50 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      <Icon size={11} /> {pct.toFixed(0)}% margin
    </span>
  );
}

interface Props {
  item: MenuItem;
  onClose: () => void;
}

export default function MenuItemCosting({ item, onClose }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipe, setRecipe] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLine, setNewLine] = useState({ ingredient_id: '', portion_g: '' });
  const [saving, setSaving] = useState(false);

  const ingMap = Object.fromEntries(ingredients.map(i => [i.id, i]));
  const docId = item.id!;
  const recipeDocRef = doc(db, 'menu_recipes', docId);

  // Load all ingredients
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'finance_ingredients'), orderBy('name')),
      snap => setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ingredient[])
    );
    return unsub;
  }, []);

  // Load this item's recipe
  useEffect(() => {
    const unsub = onSnapshot(recipeDocRef, snap => {
      if (snap.exists()) {
        setRecipe((snap.data().lines || []) as RecipeLine[]);
      } else {
        setRecipe([]);
      }
      setLoading(false);
    });
    return unsub;
  }, [docId]);

  const totalCost = () => {
    let sum = 0;
    for (const line of recipe) {
      const c = lineCost(line, ingMap);
      if (c === null) return null;
      sum += c;
    }
    return sum;
  };

  const addLine = async () => {
    if (!newLine.ingredient_id || !newLine.portion_g) return;
    const ing = ingMap[newLine.ingredient_id];
    if (!ing) return;
    const updated = [...recipe, {
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      portion_g: parseFloat(newLine.portion_g),
      unit: ing.unit,
    }];
    setSaving(true);
    try {
      await setDoc(recipeDocRef, { menu_item_id: docId, lines: updated }, { merge: true });
      setNewLine({ ingredient_id: '', portion_g: '' });
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const removeLine = async (idx: number) => {
    const updated = recipe.filter((_, i) => i !== idx);
    setSaving(true);
    try {
      await setDoc(recipeDocRef, { menu_item_id: docId, lines: updated }, { merge: true });
    } catch { toast.error('Failed to remove'); }
    setSaving(false);
  };

  const menuPrice = parseFloat(item.price) || 0;
  const cost = totalCost();
  const unknownCost = recipe.some(l => lineCost(l, ingMap) === null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <ChefHat size={20} className="text-terracotta" />
            <div>
              <h2 className="font-bold text-ink text-lg leading-tight">{item.name}</h2>
              <p className="text-xs text-gray-400">Recipe & Food Cost</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* Cost summary card */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Menu Price</p>
                <p className="text-2xl font-bold text-ink mt-0.5">฿{menuPrice.toFixed(0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Food Cost</p>
                {cost !== null
                  ? <p className="text-2xl font-bold text-terracotta mt-0.5">฿{cost.toFixed(2)}</p>
                  : <p className="text-sm text-amber-500 mt-1">Incomplete data</p>
                }
              </div>
            </div>
            {cost !== null && menuPrice > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <MarginBadge cost={cost} price={menuPrice} />
                <p className="text-sm text-gray-500">
                  Profit per dish: <span className="font-bold text-ink">฿{(menuPrice - cost).toFixed(2)}</span>
                </p>
              </div>
            )}
            {unknownCost && (
              <p className="text-xs text-amber-500 mt-3">⚠ Some ingredient costs not yet known — scan invoices to update</p>
            )}
          </div>

          {/* Recipe lines */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">Ingredients</h3>

            {loading ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading...</p>
            ) : recipe.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-sm text-gray-400">No ingredients added yet</p>
                <p className="text-xs text-gray-300 mt-1">Add ingredients below to calculate food cost</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recipe.map((line, i) => {
                  const c = lineCost(line, ingMap);
                  const ing = ingMap[line.ingredient_id];
                  return (
                    <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-ink truncate">{line.ingredient_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {line.portion_g}{line.unit === 'kg' || line.unit === 'l' ? 'g' : line.unit === 'piece' ? ' pcs' : 'ml'} per serving
                          {ing?.current_cost_per_unit ? ` · ฿${ing.current_cost_per_unit}/${ing.unit}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-3 shrink-0">
                        {c !== null
                          ? <span className="text-sm font-bold text-terracotta">฿{c.toFixed(2)}</span>
                          : <span className="text-xs text-gray-300">unknown</span>
                        }
                        <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add ingredient */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Ingredient</p>
            <select
              value={newLine.ingredient_id}
              onChange={e => setNewLine(p => ({ ...p, ingredient_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta bg-white"
            >
              <option value="">Select ingredient...</option>
              {ingredients.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.unit}){i.current_cost_per_unit ? ` — ฿${i.current_cost_per_unit}/${i.unit}` : ' — cost unknown'}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={newLine.portion_g}
                  onChange={e => setNewLine(p => ({ ...p, portion_g: e.target.value }))}
                  placeholder="Portion (g or ml per serving)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta bg-white"
                />
              </div>
              <button
                onClick={addLine}
                disabled={saving || !newLine.ingredient_id || !newLine.portion_g}
                className="px-5 py-2.5 bg-terracotta text-white rounded-xl text-sm font-bold hover:bg-terracotta/90 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                <Plus size={15} /> Add
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Enter grams for solid ingredients, ml for liquids, or count for items like eggs or bread rolls.
              {ingredients.length === 0 && ' Add ingredients in Finance → Ingredients first.'}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
