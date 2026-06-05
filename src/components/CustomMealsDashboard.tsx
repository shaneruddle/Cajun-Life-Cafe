import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  doc, 
  query, 
  orderBy,
  onSnapshot,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CustomMealItem, CustomMealOption } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { INITIAL_CUSTOM_MEALS } from '../data/initialCustomMeals';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Check, 
  AlertCircle,
  Database,
  Upload,
  Tag,
  GripVertical,
  ChevronLeft,
  LayoutGrid,
  Scale,
  Flame,
  Zap,
  Wheat,
  Droplets,
  Search,
  Trash,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableRowProps {
  item: CustomMealItem;
  startEdit: (item: CustomMealItem) => void;
  handleDelete: (id: string) => Promise<void>;
}

const SortableRow: React.FC<SortableRowProps> = ({ item, startEdit, handleDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 transition-colors ${isDragging ? 'bg-white shadow-lg' : ''}`}>
      <td className="px-6 py-4 whitespace-nowrap">
        <button 
          {...attributes} 
          {...listeners} 
          className="p-2 text-gray-400 hover:text-terracotta cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical size={20} />
        </button>
      </td>
      <td className="px-6 py-4">
        <div>
          <div className="font-bold text-ink">{item.name}</div>
          {item.description && <div className="text-xs text-gray-400 italic">{item.description}</div>}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-1.5">
          {item.options.map((opt, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] bg-gray-50 p-2 rounded-lg border border-gray-100 min-w-[200px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-olive bg-cream px-2 py-0.5 rounded border border-olive/10">{opt.weight}</span>
                <span className="font-bold text-terracotta">฿{opt.price}</span>
              </div>
              <div className="flex gap-2 text-gray-500 border-l border-gray-200 pl-2">
                <span title="Calories" className="flex items-center"><Flame size={10} className="mr-0.5 text-orange-500" />{opt.calories}</span>
                <span title="Protein" className="flex items-center"><Zap size={10} className="mr-0.5 text-blue-500" />{opt.protein}g</span>
                <span title="Carbs" className="flex items-center"><Wheat size={10} className="mr-0.5 text-amber-500" />{opt.carbs}g</span>
                <span title="Fat" className="flex items-center"><Droplets size={10} className="mr-0.5 text-yellow-600" />{opt.fat}g</span>
              </div>
            </div>
          ))}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-3 py-1 bg-cream text-olive rounded-full text-[10px] font-bold uppercase tracking-wider">
          {item.type}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => startEdit(item)}
            className="p-2 text-gray-400 hover:text-olive transition-colors"
          >
            <Edit2 size={18} />
          </button>
          <button 
            onClick={() => handleDelete(item.id!)}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default function CustomMealsDashboard() {
  const [items, setItems] = useState<CustomMealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<CustomMealItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    console.log(msg);
    setDebugLogs(prev => [msg, ...prev].slice(0, 10));
  };
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');

  const [formData, setFormData] = useState<Partial<CustomMealItem>>({
    name: '',
    type: 'Protein',
    description: '',
    order: 0,
    options: []
  });

  const [newOption, setNewOption] = useState<CustomMealOption>({
    weight: '',
    price: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    // Safety timeout to prevent getting stuck in loading state
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    const q = query(collection(db, 'custom_meals'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomMealItem[];
      setItems(customItems);
      setLoading(false);
    }, (err) => {
      console.error("Firestore onSnapshot error:", err);
      setError(`Failed to load items: ${err.message}`);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex) as CustomMealItem[];
      setItems(newItems);

      try {
        const batch = writeBatch(db);
        newItems.forEach((item, index) => {
          if (item.id) {
            const itemRef = doc(db, 'custom_meals', item.id);
            batch.update(itemRef, { order: index });
          }
        });
        await batch.commit();
        setSuccess('Order updated!');
      } catch (err) {
        setError('Failed to save new order.');
        handleFirestoreError(err, 'update', 'custom_meals');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, 'custom_meals', editingItem.id), {
          ...formData,
          uid: auth.currentUser?.uid
        });
        await logActivity('Custom Meal Updated', `Updated custom meal: ${formData.name}`, 'custom_meal');
        setSuccess('Item updated successfully!');
      } else {
        await addDoc(collection(db, 'custom_meals'), {
          ...formData,
          uid: auth.currentUser?.uid
        });
        await logActivity('Custom Meal Created', `Created custom meal: ${formData.name}`, 'custom_meal');
        setSuccess('Item added successfully!');
      }
      resetForm();
    } catch (err) {
      setError('Failed to save item.');
      handleFirestoreError(err, editingItem ? 'update' : 'create', 'custom_meals');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'custom_meals', id));
      await logActivity('Custom Meal Deleted', `Deleted custom meal ID: ${id}`, 'custom_meal');
      setSuccess('Item deleted successfully!');
    } catch (err) {
      handleFirestoreError(err, 'delete', `custom_meals/${id}`);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(false);
    setLoading(true);
    setError(null);
    setSuccess(null);
    addLog("Starting delete all process...");
    
    try {
      const q = query(collection(db, 'custom_meals'));
      const snapshot = await getDocs(q);
      
      addLog(`Found ${snapshot.docs.length} items to delete.`);
      if (snapshot.empty) {
        setSuccess('No items to delete.');
        return;
      }

      // Firestore batches are limited to 500 operations
      const chunks = [];
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        chunks.push(snapshot.docs.slice(i, i + 500));
      }

      addLog(`Deleting in ${chunks.length} batches...`);
      let deletedCount = 0;
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        deletedCount += chunk.length;
        addLog(`Deleted batch of ${chunk.length}. Total: ${deletedCount}`);
      }

      setSuccess(`Successfully deleted ${snapshot.docs.length} items.`);
      addLog("Delete all process completed successfully.");
    } catch (err: any) {
      addLog(`Delete all error: ${err.message}`);
      setError(`Failed to delete all items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSequentialDelete = async () => {
    if (!window.confirm('SEQUENTIAL DELETE: This is slower but more reliable. Continue?')) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    addLog("Starting sequential delete...");
    
    try {
      const q = query(collection(db, 'custom_meals'));
      const snapshot = await getDocs(q);
      
      addLog(`Found ${snapshot.docs.length} items to delete sequentially.`);
      if (snapshot.empty) {
        setSuccess('No items to delete.');
        return;
      }

      let count = 0;
      for (const document of snapshot.docs) {
        await deleteDoc(document.ref);
        count++;
        if (count % 50 === 0) {
          addLog(`Deleted ${count}/${snapshot.docs.length}...`);
        }
      }

      setSuccess(`Successfully deleted ${count} items sequentially.`);
      addLog("Sequential delete completed.");
    } catch (err: any) {
      addLog(`Sequential delete error: ${err.message}`);
      setError(`Sequential delete failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const countItems = async () => {
    addLog("Counting items...");
    try {
      const q = query(collection(db, 'custom_meals'));
      const snapshot = await getDocs(q);
      addLog(`Total items in database: ${snapshot.docs.length}`);
      setSuccess(`Found ${snapshot.docs.length} items.`);
    } catch (err: any) {
      addLog(`Count error: ${err.message}`);
      setError(`Count failed: ${err.message}`);
    }
  };
  const testPermissions = async () => {
    addLog("Testing admin permissions...");
    try {
      const testRef = doc(collection(db, 'custom_meals'), 'test_perm_check');
      await setDoc(testRef, { 
        name: 'Test Permission', 
        type: 'Test', 
        order: 9999,
        uid: auth.currentUser?.uid 
      });
      addLog("Write test: SUCCESS");
      await deleteDoc(testRef);
      addLog("Delete test: SUCCESS");
      setSuccess("Permissions verified! You are an admin.");
    } catch (err: any) {
      addLog(`Permission test FAILED: ${err.message}`);
      setError(`Permission test failed: ${err.message}. You might not be logged in as the correct admin.`);
    }
  };

  const seedData = async () => {
    if (!window.confirm('This will add initial custom meal ingredients to the database. Continue?')) return;
    setLoading(true);
    try {
      for (const item of INITIAL_CUSTOM_MEALS) {
        await addDoc(collection(db, 'custom_meals'), {
          ...item,
          uid: auth.currentUser?.uid
        });
      }
      setSuccess('Database seeded successfully!');
    } catch (err) {
      setError('Failed to seed database.');
      handleFirestoreError(err, 'create', 'custom_meals');
    } finally {
      setLoading(false);
    }
  };

  const addOption = () => {
    if (!newOption.weight || !newOption.price) return;
    setFormData({
      ...formData,
      options: [...(formData.options || []), newOption]
    });
    setNewOption({
      weight: '',
      price: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options?.filter((_, i) => i !== index)
    });
  };

  const resetForm = () => {
    setEditingItem(null);
    setIsAdding(false);
    setFormData({
      name: '',
      type: 'Protein',
      description: '',
      order: 0,
      options: []
    });
  };

  const types = useMemo(() => {
    const t = Array.from(new Set(items.map(item => item.type)));
    return ['All', ...t.sort()];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'All' || item.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [items, searchTerm, filterType]);

  const startEdit = (item: CustomMealItem) => {
    setEditingItem(item);
    setFormData(item);
    setIsAdding(true);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 relative z-0 pt-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-20 gap-8">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 hover:bg-white rounded-full transition-all text-gray-400 hover:text-terracotta">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-4xl font-display font-bold text-ink">Custom Meals Menu</h1>
              <p className="text-gray-500 mt-2">Manage ingredients and nutritional options for custom meals.</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`w-2 h-2 rounded-full ${auth.currentUser?.email === 'info@cajunlifecafe.com' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                  Admin Status: {auth.currentUser?.email === 'info@cajunlifecafe.com' ? 'Verified' : 'Unauthorized'} ({auth.currentUser?.email || 'Not Logged In'})
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/import-custom-meals"
              className="flex items-center gap-2 px-6 py-2 bg-olive text-white rounded-full hover:bg-opacity-90 transition-all text-sm font-medium"
            >
              <Plus size={18} /> Bulk Import
            </Link>
            <button 
              onClick={seedData}
              className="flex items-center gap-2 px-6 py-2 bg-white text-ink border border-gray-200 rounded-full hover:bg-gray-50 transition-all text-sm font-medium shadow-sm"
            >
              <Database size={18} className="text-terracotta" /> Seed Data
            </button>
            <button 
              onClick={() => setIsDeletingAll(true)}
              className="flex items-center gap-2 px-6 py-2 bg-white text-red-500 border border-red-100 rounded-full hover:bg-red-50 transition-all text-sm font-medium shadow-sm"
            >
              <Trash size={18} /> Delete All
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-6 py-2 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all text-sm font-medium shadow-lg"
            >
              <Plus size={18} /> Add New
            </button>
          </div>
        </header>

        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search ingredients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="text-gray-400" size={18} />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 md:w-48 px-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50 font-medium text-sm"
            >
              {types.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center gap-3 rounded-r-lg">
            <Check size={20} />
            <p>{success}</p>
          </div>
        )}

        {debugLogs.length > 0 && (
          <div className="mb-6 p-4 bg-gray-900 text-green-400 font-mono text-xs rounded-2xl shadow-inner overflow-hidden">
            <div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
              <span className="uppercase tracking-widest font-bold">Debug Console</span>
              <button onClick={() => setDebugLogs([])} className="hover:text-white">Clear</button>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {debugLogs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={countItems} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg">Count Items</button>
              <button onClick={testPermissions} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg">Test Perms</button>
              <button onClick={handleSequentialDelete} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg">Sequential Delete</button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {isDeletingAll && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-ink/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-red-100"
              >
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-6 mx-auto">
                  <Trash size={32} />
                </div>
                <h3 className="text-2xl font-display font-bold text-ink text-center mb-2">Delete Everything?</h3>
                <p className="text-gray-500 text-center mb-8">
                  This will permanently remove ALL custom meal ingredients. This action cannot be undone.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsDeletingAll(false)}
                    className="px-6 py-4 rounded-2xl bg-gray-50 text-gray-500 font-bold hover:bg-gray-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteAll}
                    className="px-6 py-4 rounded-2xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                  >
                    Yes, Delete All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {isAdding && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[32px] shadow-xl p-8 mb-12 border border-gray-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-display font-bold text-ink">
                  {editingItem ? 'Edit Ingredient' : 'Add New Ingredient'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-gray-400">Ingredient Name *</label>
                      <input 
                        required
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                        placeholder="e.g. Chicken Breast"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-gray-400">Category *</label>
                      <select 
                        value={formData.type}
                        onChange={e => setFormData({...formData, type: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-white"
                      >
                        <option>Protein</option>
                        <option>Carbohydrates</option>
                        <option>Fats</option>
                        <option>Vegetables</option>
                        <option>Eggs</option>
                        <option>Fresh Fruit</option>
                        <option>Protein Pancakes</option>
                        <option>Seasoning/Sauce</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-gray-400">Description (Optional)</label>
                      <input 
                        value={formData.description}
                        onChange={e => setFormData({...formData, description: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                        placeholder="e.g. (All Exact Weights are Before Cooking)"
                      />
                    </div>
                  </div>

                  <div className="space-y-6 bg-gray-50 p-6 rounded-3xl">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Scale size={20} className="text-terracotta" /> Weight Options & Nutrition
                    </h3>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Weight/Label</label>
                          <input 
                            value={newOption.weight}
                            onChange={e => setNewOption({...newOption, weight: e.target.value})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                            placeholder="50 G"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">Price (฿)</label>
                          <input 
                            type="number"
                            value={newOption.price}
                            onChange={e => setNewOption({...newOption, price: Number(e.target.value)})}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1"><Flame size={10}/> Cal</label>
                          <input 
                            type="number"
                            value={newOption.calories}
                            onChange={e => setNewOption({...newOption, calories: Number(e.target.value)})}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1"><Zap size={10}/> Pro</label>
                          <input 
                            type="number"
                            value={newOption.protein}
                            onChange={e => setNewOption({...newOption, protein: Number(e.target.value)})}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1"><Wheat size={10}/> Carb</label>
                          <input 
                            type="number"
                            value={newOption.carbs}
                            onChange={e => setNewOption({...newOption, carbs: Number(e.target.value)})}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400 flex items-center gap-1"><Droplets size={10}/> Fat</label>
                          <input 
                            type="number"
                            value={newOption.fat}
                            onChange={e => setNewOption({...newOption, fat: Number(e.target.value)})}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                          />
                        </div>
                      </div>

                      <button 
                        type="button"
                        onClick={addOption}
                        className="w-full py-2 bg-olive text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition-all"
                      >
                        Add Option
                      </button>
                    </div>

                    <div className="mt-6 space-y-2">
                      {formData.options?.map((opt, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm">{opt.weight} - {opt.price}฿</span>
                            <span className="text-[10px] text-gray-400">
                              C:{opt.calories} P:{opt.protein} C:{opt.carbs} F:{opt.fat}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => removeOption(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="px-8 py-3 rounded-full font-medium border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="terracotta-button flex items-center gap-2"
                  >
                    <Save size={18} /> {editingItem ? 'Update Ingredient' : 'Save Ingredient'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="bg-white rounded-[32px] shadow-sm overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 w-10"></th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Ingredient</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Options & Nutrition</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Category</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <SortableContext 
                    items={filteredItems.map(i => i.id!)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredItems.map((item) => (
                      <SortableRow 
                        key={item.id} 
                        item={item} 
                        startEdit={startEdit}
                        handleDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </div>
          </div>
        </DndContext>
      </div>
    </div>
  );
}
