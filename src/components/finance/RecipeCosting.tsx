import { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { IngredientPurchase } from './types';
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Pencil, X, Star } from 'lucide-react';
import { toast } from 'sonner';

interface RecipeIngredient {
  purchase_id: string;
  ingredient_name: string;
  portion_g: number;   // amount used per serving (g, ml, or count)
  unit: string;        // purchase unit (kg, g, l, purchase, etc)
  unit_cost: number;   // cost per purchase unit at time of adding
  quantity: number;    // purchase quantity (e.g. 5 units of 1kg)
}

interface Recipe {
  id: string;
  name: string;
  menu_price: number;
  ingredients: RecipeIngredient[];
  category: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['Food', 'Drinks', 'Desserts', 'Other'];

// Calculate cost of one ingredient in a dish
// unit_cost is cost per purchase unit (e.g. ฿1320 per 20kg bag)
// portion_g is how much is used per serving
function calcIngredientCost(ri: RecipeIngredient): number | null {
  if (!ri.unit_cost || !ri.quantity) return null;
  const unit = ri.unit?.toLowerCase() ?? '';

  // Determine total grams/ml in the purchase
  let totalBaseUnits: number;
  if (unit === 'kg') totalBaseUnits = ri.quantity * 1000;
  else if (unit === 'l') totalBaseUnits = ri.quantity * 1000;
  else if (unit === 'g' || unit === 'ml') totalBaseUnits = ri.quantity;
  else totalBaseUnits = ri.quantity; // piece / purchase — treat as count

  const costPerBaseUnit = ri.unit_cost / totalBaseUnits;
  return costPerBaseUnit * ri.portion_g;
}

function MarginBadge({ cost, price }: { cost: number; price: number }) {
  const margin = ((price - cost) / price) * 100;
  const color = margin >= 65 ? 'bg-green-100 text-green-700'
              : margin >= 50 ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700';
  const Icon = margin >= 65 ? TrendingUp : margin >= 50 ? Minus : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>
      <Icon size={11} /> {margin.toFixed(0)}% margin
    </span>
  );
}

export default function RecipeCosting() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [starredPurchases, setStarredPurchases] = useState<IngredientPurchase[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);

  const [form, setForm] = useState({
    name: '', menu_price: '', category: 'Food',
    ingredients: [] as RecipeIngredient[],
  });
  const [newIng, setNewIng] = useState({ purchase_id: '', portion_g: '' });

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'recipes'), orderBy('name')),
      snap => setRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Recipe[])
    );
    const unsub2 = onSnapshot(
      query(collection(db, 'ingredient_purchases'), where('starred', '==', true)),
      snap => setStarredPurchases(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.ingredient_name ?? '').localeCompare(b.ingredient_name ?? '')) as IngredientPurchase[])
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  const purchaseMap = Object.fromEntries(starredPurchases.map(p => [p.id, p]));

  const calcTotalCost = (recipe: Recipe): number | null => {
    let total = 0;
    for (const ri of recipe.ingredients) {
      const c = calcIngredientCost(ri);
      if (c === null) return null;
      total += c;
    }
    return total;
  };

  const openNew = () => {
    setEditingRecipe(null);
    setForm({ name: '', menu_price: '', category: 'Food', ingredients: [] });
    setNewIng({ purchase_id: '', portion_g: '' });
    setShowForm(true);
  };

  const openEdit = (r: Recipe) => {
    setEditingRecipe(r);
    setForm({ name: r.name, menu_price: String(r.menu_price), category: r.category, ingredients: [...r.ingredients] });
    setNewIng({ purchase_id: '', portion_g: '' });
    setShowForm(true);
  };

  const addIngredient = () => {
    if (!newIng.purchase_id || !newIng.portion_g) return;
    const p = purchaseMap[newIng.purchase_id];
    if (!p) return;
    setForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, {
        purchase_id: p.id,
        ingredient_name: p.ingredient_name,
        portion_g: parseFloat(newIng.portion_g),
        unit: p.unit,
        unit_cost: p.unit_cost,
        quantity: p.quantity,
      }],
    }));
    setNewIng({ purchase_id: '', portion_g: '' });
  };

  const removeIngredient = (idx: number) => {
    setForm(p => ({ ...p, ingredients: p.ingredients.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    if (!form.name || !form.menu_price) { toast.error('Name and price required'); return; }
    const data = {
      name: form.name,
      menu_price: parseFloat(form.menu_price),
      category: form.category,
      ingredients: form.ingredients,
      updated_at: new Date().toISOString(),
    };
    try {
      if (editingRecipe) {
        await updateDoc(doc(db, 'recipes', editingRecipe.id), data);
        toast.success('Recipe updated');
      } else {
        await addDoc(collection(db, 'recipes'), { ...data, created_at: new Date().toISOString() });
        toast.success('Recipe added');
      }
      setShowForm(false);
    } catch { toast.error('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recipe?')) return;
    await deleteDoc(doc(db, 'recipes', id));
    toast.success('Deleted');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Recipe Costing</h1>
          <p className="text-sm text-gray-500 mt-1">Build dishes from ingredients to calculate food cost and margin</p>
          {starredPurchases.length === 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              Star ingredients in the Ingredients tab to add them here
            </p>
          )}
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-xl font-bold text-sm hover:bg-terracotta/90 transition-all">
          <Plus size={16} /> Add Recipe
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-ink">{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dish Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Chicken Wrap" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Menu Price (฿)</label>
              <input type="number" value={form.menu_price} onChange={e => setForm(p => ({ ...p, menu_price: e.target.value }))}
                placeholder="220" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Ingredients in recipe */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ingredients</label>
            {form.ingredients.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.ingredients.map((ri, i) => {
                  const cost = calcIngredientCost(ri);
                  return (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                      <div>
                        <span className="text-sm font-semibold text-ink">{ri.ingredient_name}</span>
                        <span className="text-xs text-gray-400 ml-2">{ri.portion_g} {ri.unit === 'kg' || ri.unit === 'l' ? 'g' : ri.unit === 'piece' ? 'pcs' : ri.unit === 'ml' ? 'ml' : 'units'} per serving</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {cost !== null
                          ? <span className="text-sm font-bold text-terracotta">฿{cost.toFixed(2)}</span>
                          : <span className="text-xs text-gray-400">cost unknown</span>
                        }
                        <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add ingredient row */}
            <div className="flex gap-2">
              <select
                value={newIng.purchase_id}
                onChange={e => setNewIng(p => ({ ...p, purchase_id: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
              >
                <option value="">Select ingredient...</option>
                {starredPurchases.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.ingredient_name} — ฿{p.unit_cost}/{p.unit}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={newIng.portion_g}
                onChange={e => setNewIng(p => ({ ...p, portion_g: e.target.value }))}
                placeholder="portion"
                className="w-28 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta"
              />
              <button onClick={addIngredient} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-700">
                + Add
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter grams or ml for solid/liquid ingredients, or count for items like eggs. Star ingredients in the Ingredients tab first.</p>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-gray-600 font-medium text-sm">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-2.5 bg-terracotta text-white rounded-xl font-bold text-sm hover:bg-terracotta/90">
              {editingRecipe ? 'Update Recipe' : 'Save Recipe'}
            </button>
          </div>
        </div>
      )}

      {/* Recipe list */}
      {recipes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 italic">No recipes yet — add your first dish above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map(recipe => {
            const cost = calcTotalCost(recipe);
            const isExpanded = expandedId === recipe.id;
            return (
              <div key={recipe.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center p-4 gap-4">
                  <button onClick={() => setExpandedId(isExpanded ? null : recipe.id)} className="flex-1 text-left">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-ink text-lg">{recipe.name}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{recipe.category}</span>
                      {cost !== null && <MarginBadge cost={cost} price={recipe.menu_price} />}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm text-gray-500">Menu price: <span className="font-semibold text-ink">฿{recipe.menu_price}</span></span>
                      {cost !== null
                        ? <span className="text-sm text-gray-500">Food cost: <span className="font-semibold text-terracotta">฿{cost.toFixed(2)}</span></span>
                        : <span className="text-xs text-amber-500">⚠ Some ingredient costs unknown</span>
                      }
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openEdit(recipe)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-400"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(recipe.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={15} /></button>
                    <button onClick={() => setExpandedId(isExpanded ? null : recipe.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50 pt-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase tracking-wider">
                          <th className="text-left pb-2">Ingredient</th>
                          <th className="text-right pb-2">Portion</th>
                          <th className="text-right pb-2">Cost/unit</th>
                          <th className="text-right pb-2">Cost/serving</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {recipe.ingredients.map((ri, i) => {
                          const cost = calcIngredientCost(ri);
                          return (
                            <tr key={i}>
                              <td className="py-2 font-medium text-ink">{ri.ingredient_name}</td>
                              <td className="py-2 text-right text-gray-500">{ri.portion_g} {ri.unit}</td>
                              <td className="py-2 text-right text-gray-500">
                                {ri.unit_cost ? `฿${ri.unit_cost}/${ri.unit}` : '—'}
                              </td>
                              <td className="py-2 text-right font-semibold">
                                {cost !== null ? `฿${cost.toFixed(2)}` : <span className="text-gray-300">unknown</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {cost !== null && (
                          <tr className="border-t-2 border-gray-200">
                            <td colSpan={3} className="pt-3 font-bold text-ink">Total food cost</td>
                            <td className="pt-3 text-right font-bold text-terracotta text-base">฿{cost.toFixed(2)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
