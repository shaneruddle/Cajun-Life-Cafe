import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { MenuItem, Category } from '../../types';
import { handleFirestoreError } from '../../utils/firestore';
import {
  RecipeLine, RecipeDoc, totalRecipeCost, foodCostPct, marginPct, getCostHealth, CostHealth,
} from '../../utils/foodCost';
import { MarginBadge, FoodCostBadge } from './CostBadges';
import MenuItemCosting from './MenuItemCosting';
import { Search, Filter, Calculator, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

const BAHT = String.fromCharCode(0x0e3f);
const EM_DASH = String.fromCharCode(0x2014);

const HEALTH_LABELS: Record<CostHealth, string> = {
  healthy: 'Healthy (<=30%)',
  watch: 'Watch (31-40%)',
  high: 'High (>40%)',
  unknown: 'Not costed',
};

interface Row {
  item: MenuItem;
  price: number;
  cost: number | null;
  costingComplete: boolean;
  health: CostHealth;
}

type SortField = 'name' | 'category' | 'price' | 'cost' | 'foodCostPct' | 'marginPct';
type SortDirection = 'asc' | 'desc';

const SORT_COLUMNS: { field: SortField; label: string; align?: 'right' }[] = [
  { field: 'name', label: 'Item' },
  { field: 'category', label: 'Category' },
  { field: 'price', label: 'Selling Price', align: 'right' },
  { field: 'cost', label: 'Food Cost', align: 'right' },
  { field: 'foodCostPct', label: 'Food Cost %' },
  { field: 'marginPct', label: 'Margin %' },
];

function sortValue(row: Row, field: SortField): number | string {
  switch (field) {
    case 'name': return row.item.name?.toLowerCase() || '';
    case 'category': return row.item.category?.toLowerCase() || '';
    case 'price': return row.price;
    case 'cost': return row.cost ?? -1;
    case 'foodCostPct': return row.cost !== null && row.price > 0 ? (foodCostPct(row.cost, row.price) ?? -1) : -1;
    case 'marginPct': return row.cost !== null && row.price > 0 ? (marginPct(row.cost, row.price) ?? -1) : -1;
  }
}

export default function FoodCostsDashboard() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [recipes, setRecipes] = useState<Record<string, RecipeDoc>>({});
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterHealth, setFilterHealth] = useState<'All' | CostHealth>('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  const toggleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 4000);

    const itemsQuery = query(collection(db, 'menu'), orderBy('order', 'asc'));
    const unsubItems = onSnapshot(itemsQuery, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })) as MenuItem[]);
      setLoading(false);
    }, err => {
      handleFirestoreError(err, 'list', 'menu');
      setLoading(false);
    });

    const categoriesQuery = query(collection(db, 'categories'), orderBy('order', 'asc'));
    const unsubCategories = onSnapshot(categoriesQuery, snap => {
      setCategoriesList(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Category[]);
    }, err => handleFirestoreError(err, 'list', 'categories'));

    const unsubRecipes = onSnapshot(collection(db, 'menu_recipes'), snap => {
      const map: Record<string, RecipeDoc> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[d.id] = {
          lines: (data.lines || []) as RecipeLine[],
          costingComplete: data.costingComplete === true,
        };
      });
      setRecipes(map);
    }, err => handleFirestoreError(err, 'list', 'menu_recipes'));

    return () => {
      unsubItems();
      unsubCategories();
      unsubRecipes();
      clearTimeout(timer);
    };
  }, []);

  const categories = useMemo(() => {
    const fromCollection = categoriesList.map(c => c.name);
    const fromItems = items.map(item => item.category);
    const allUnique = Array.from(new Set([...fromCollection, ...fromItems])).filter(Boolean);
    return ['All', ...allUnique.sort()];
  }, [items, categoriesList]);

  const rows: Row[] = useMemo(() => {
    return items.map(item => {
      const recipe = recipes[item.id!];
      const cost = recipe && recipe.lines.length > 0 ? totalRecipeCost(recipe.lines) : null;
      const price = parseFloat(item.price) || 0;
      return {
        item,
        price,
        cost,
        costingComplete: recipe?.costingComplete === true,
        health: getCostHealth(cost, price),
      };
    });
  }, [items, recipes]);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter(row => {
      const matchesSearch = !searchTerm ||
        row.item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || row.item.category === filterCategory;
      const matchesHealth = filterHealth === 'All' || row.health === filterHealth;
      return matchesSearch && matchesCategory && matchesHealth;
    });
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortField);
      const bv = sortValue(b, sortField);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, searchTerm, filterCategory, filterHealth, sortField, sortDirection]);

  const costedCount = rows.filter(r => r.cost !== null).length;

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 relative z-0 pt-8">
      <div className="max-w-6xl mx-auto mt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-display font-bold text-ink">Food Costs</h1>
            <p className="text-gray-500 mt-2">
              Selling price vs. recipe cost across the menu.{' '}
              <span className="font-semibold text-ink">{costedCount}</span> of{' '}
              <span className="font-semibold text-ink">{items.length}</span> items costed.
            </p>
          </div>
        </header>

        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search items by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="text-gray-400 shrink-0" size={18} />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 md:w-48 px-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50 font-medium text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filterHealth}
              onChange={(e) => setFilterHealth(e.target.value as 'All' | CostHealth)}
              className="flex-1 md:w-48 px-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50 font-medium text-sm"
            >
              <option value="All">All food cost levels</option>
              {(Object.keys(HEALTH_LABELS) as CostHealth[]).map(h => (
                <option key={h} value={h}>{HEALTH_LABELS[h]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {SORT_COLUMNS.map(col => (
                    <th
                      key={col.field}
                      onClick={() => toggleSort(col.field)}
                      className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 cursor-pointer select-none hover:text-ink transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                    >
                      <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                        {col.label}
                        {sortField === col.field
                          ? (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                          : <ArrowUpDown size={12} className="text-gray-300" />
                        }
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRows.map(row => (
                  <tr
                    key={row.item.id}
                    onClick={() => setSelectedItem(row.item)}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calculator size={14} className="text-terracotta shrink-0" />
                        <span className="font-semibold text-sm text-ink">{row.item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{row.item.category}</td>
                    <td className="px-6 py-4 text-sm font-bold text-ink text-right">{BAHT}{row.price.toFixed(0)}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      {row.cost !== null
                        ? <span className="font-bold text-terracotta">{BAHT}{row.cost.toFixed(2)}</span>
                        : <span className="text-xs text-amber-500">Not costed</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      {row.cost !== null && row.price > 0
                        ? <FoodCostBadge cost={row.cost} price={row.price} />
                        : <span className="text-xs text-gray-300">{EM_DASH}</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      {row.cost !== null && row.price > 0
                        ? <MarginBadge cost={row.cost} price={row.price} />
                        : <span className="text-xs text-gray-300">{EM_DASH}</span>
                      }
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <AlertCircle size={28} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-sm text-gray-400">No items match your search or filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedItem && (
        <MenuItemCosting item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
