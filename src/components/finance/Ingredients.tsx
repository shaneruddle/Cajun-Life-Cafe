import { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Ingredient } from './types';
import { MenuItem } from '../../types';
import { Plus, ChevronDown, ChevronUp, Scale } from 'lucide-react';
import { toast } from 'sonner';

const UNITS = ['g', 'kg', 'ml', 'l', 'piece', 'bunch', 'can', 'bag'];

export default function Ingredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'g', grams_per_serving: '', menu_item_ids: [] as string[] });

  useEffect(() => {
    const q = query(collection(db, 'finance_ingredients'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => setIngredients(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Ingredient[]));

    // Load menu items for linking
    getDocs(query(collection(db, 'menu'), orderBy('name', 'asc'))).then(snap => {
      setMenuItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[]);
    });

    return unsub;
  }, []);

  const handleSave = async () => {
    if (!form.name || !form.unit) { toast.error('Name and unit required'); return; }
    try {
      await addDoc(collection(db, 'finance_ingredients'), {
        name: form.name,
        unit: form.unit,
        grams_per_serving: parseFloat(form.grams_per_serving) || 0,
        menu_item_ids: form.menu_item_ids,
        current_cost_per_unit: null,
      });
      toast.success('Ingredient added');
      setForm({ name: '', unit: 'g', grams_per_serving: '', menu_item_ids: [] });
      setShowForm(false);
    } catch (err) {
      toast.error('Failed to save');
    }
  };

  const toggleMenuItem = (id: string) => {
    setForm(p => ({
      ...p,
      menu_item_ids: p.menu_item_ids.includes(id)
        ? p.menu_item_ids.filter(i => i !== id)
        : [...p.menu_item_ids, id],
    }));
  };

  const costPerDish = (ingredient: Ingredient) => {
    if (!ingredient.current_cost_per_unit || !ingredient.grams_per_serving) return null;
    // cost_per_unit is per unit (e.g. per gram), grams_per_serving is grams used per dish
    const costPerGram = ingredient.unit === 'kg'
      ? ingredient.current_cost_per_unit / 1000
      : ingredient.current_cost_per_unit;
    return costPerGram * ingredient.grams_per_serving;
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ingredients</h1>
          <p className="text-sm text-gray-500 mt-1">Track ingredient costs and map them to menu dishes</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-terracotta text-white rounded-xl font-bold text-sm hover:bg-terracotta/90 transition-all">
          <Plus size={16} /> Add Ingredient
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-bold text-ink mb-4">New Ingredient</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Chicken breast" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase unit</label>
              <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grams per serving</label>
              <input type="number" value={form.grams_per_serving} onChange={e => setForm(p => ({ ...p, grams_per_serving: e.target.value }))} placeholder="e.g. 150" className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-terracotta" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Used in dishes (select all that apply)</label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 grid grid-cols-2 gap-2">
              {menuItems.map(item => (
                <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:bg-cream rounded-lg px-2 py-1">
                  <input type="checkbox" checked={form.menu_item_ids.includes(item.id)} onChange={() => toggleMenuItem(item.id)} className="accent-terracotta" />
                  <span className="text-sm text-ink truncate">{item.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-2 bg-terracotta text-white rounded-xl font-bold hover:bg-terracotta/90">Save</button>
          </div>
        </div>
      )}

      {ingredients.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-gray-200">
          <Scale size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 italic">No ingredients yet — add some above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ingredients.map(ing => {
            const dishCost = costPerDish(ing);
            const linkedDishes = menuItems.filter(m => ing.menu_item_ids?.includes(m.id));
            const isExpanded = expandedId === ing.id;

            return (
              <div key={ing.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : ing.id)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-all">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-bold text-ink">{ing.name}</p>
                      <p className="text-xs text-gray-400">
                        {ing.grams_per_serving}g per serving · {ing.unit}
                        {ing.current_cost_per_unit ? ` · ฿${ing.current_cost_per_unit}/${ing.unit}` : ' · cost unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {dishCost !== null && (
                      <span className="text-sm font-bold text-terracotta">฿{dishCost.toFixed(2)}/dish</span>
                    )}
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <p className="text-sm font-medium text-gray-600 mt-3 mb-2">Used in:</p>
                    {linkedDishes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Not linked to any dishes</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {linkedDishes.map(d => (
                          <span key={d.id} className="px-3 py-1 bg-cream text-ink text-xs rounded-full font-medium">{d.name}</span>
                        ))}
                      </div>
                    )}
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
