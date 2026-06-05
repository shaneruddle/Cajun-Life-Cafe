import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, auth , menuDb} from '../firebase';
import { Category } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { logActivity } from '../utils/logger';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  GripVertical,
  LayoutGrid,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
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
  category: Category;
  index: number;
  startEdit: (category: Category) => void;
  handleDelete: (id: string) => Promise<void>;
}

const SortableRow: React.FC<SortableRowProps> = ({ category, index, startEdit, handleDelete }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
    opacity: isDragging ? 0.5 : 1,
  };

  const onDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await handleDelete(category.id!);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 transition-colors ${isDragging ? 'bg-white shadow-lg' : ''}`}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <button 
            {...attributes} 
            {...listeners} 
            className="p-2 text-gray-400 hover:text-terracotta cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical size={20} />
          </button>
          <span className="text-xs font-mono text-gray-400">#{index + 1}</span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="font-bold text-ink">{category.name}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startEdit(category);
            }}
            className="p-2 text-gray-400 hover:text-olive transition-colors"
          >
            <Edit2 size={18} />
          </button>
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className={`p-2 transition-colors ${isDeleting ? 'text-gray-300' : 'text-gray-400 hover:text-red-500'}`}
          >
            {isDeleting ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </td>
    </tr>
  );
};

export default function CategoriesDashboard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

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
    const q = query(collection(menuDb, 'categories'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(cats);
      setLoading(false);
    }, (err) => {
      console.error("Categories snapshot error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);

      const newCategories = arrayMove(categories, oldIndex, newIndex) as Category[];
      setCategories(newCategories);

      try {
        const batch = writeBatch(db);
        newCategories.forEach((c, index) => {
          if (c.id) {
            const ref = doc(menuDb, 'categories', c.id);
            batch.update(ref, { order: index });
          }
        });
        await batch.commit();
        setSuccess('Category order updated!');
      } catch (err) {
        console.error("Error updating order:", err);
        setError('Failed to save new order.');
        handleFirestoreError(err, 'update', 'categories');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    setError(null);
    try {
      if (editingCategory?.id) {
        await updateDoc(doc(menuDb, 'categories', editingCategory.id), {
          name: newName,
          uid: auth.currentUser?.uid
        });
        await logActivity('Category Updated', `Updated category: ${newName}`, 'category');
        setSuccess('Category updated successfully!');
      } else {
        await addDoc(collection(menuDb, 'categories'), {
          name: newName,
          order: categories.length,
          uid: auth.currentUser?.uid
        });
        await logActivity('Category Created', `Created category: ${newName}`, 'category');
        setSuccess('Category added successfully!');
      }
      resetForm();
    } catch (err) {
      setError('Failed to save category.');
      handleFirestoreError(err, editingCategory ? 'update' : 'create', 'categories');
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) {
      console.error("No category ID provided for deletion");
      setError("Cannot delete: Invalid category ID.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this category?")) return;
    
    setError(null);
    setSuccess(null);
    
    console.log(`Starting deletion for category: ${id}`);
    
    try {
      // 1. Firebase Integration: Use correct ref and doc ID
      const categoryRef = doc(menuDb, 'categories', id);
      console.log("Deleting document:", categoryRef.path);
      await deleteDoc(categoryRef);

      console.log(`Successfully deleted category: ${id}`);

      // 2. State Update: Filter locally for immediate response
      setCategories(prev => prev.filter(c => c.id !== id));

      await logActivity('Category Deleted', `Deleted category ID: ${id}`, 'category');
      setSuccess('Category deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Firebase Deletion Error:", err);
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`Failed to delete category: ${errorMessage}`);
      alert(`Delete failed: ${errorMessage}`);
      handleFirestoreError(err, 'delete', `categories/${id}`);
    }
  };

  const resetForm = () => {
    setEditingCategory(null);
    setIsAdding(false);
    setNewName('');
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setNewName(category.name);
    setIsAdding(true);
  };

  const syncFromMenu = async () => {
    setIsSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      // 1. Get all menu items
      const menuSnap = await getDocs(collection(menuDb, 'menu'));
      const menuCategories = Array.from(new Set(menuSnap.docs.map(doc => doc.data().category as string)));
      
      // 2. Get existing categories
      const existingNames = categories.map(c => c.name);
      
      // 3. Find missing categories
      const missing = menuCategories.filter(name => !existingNames.includes(name));
      
      if (missing.length === 0) {
        setSuccess('All categories from menu are already present.');
        setIsSyncing(false);
        return;
      }

      // 4. Add missing categories
      const batch = writeBatch(db);
      missing.forEach((name, index) => {
        const newDocRef = doc(collection(menuDb, 'categories'));
        batch.set(newDocRef, {
          name,
          order: categories.length + index,
          uid: auth.currentUser?.uid
        });
      });
      
      await batch.commit();
      setSuccess(`Successfully imported ${missing.length} new categories from menu!`);
    } catch (err) {
      console.error("Sync error:", err);
      setError('Failed to sync categories from menu.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream p-6 md:p-12 relative z-0 pt-8">
      <div className="max-w-4xl mx-auto mt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <Link to="/dashboard" className="flex items-center gap-2 text-gray-500 hover:text-terracotta transition-colors mb-4">
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-display font-bold text-ink">Menu Categories</h1>
            <p className="text-gray-500 mt-2">Manage the order and names of your menu categories.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={syncFromMenu}
              disabled={isSyncing}
              className="flex items-center gap-2 px-6 py-3 bg-white text-terracotta border-2 border-terracotta rounded-full hover:bg-terracotta hover:text-white transition-all shadow-md font-bold disabled:opacity-50"
            >
              <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync from Menu'}
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all shadow-lg font-bold"
            >
              <Plus size={20} /> Add Category
            </button>
          </div>
        </header>

        <AnimatePresence>
          {(error || success) && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-8 p-4 rounded-2xl flex items-center gap-3 ${error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
            >
              <LayoutGrid size={20} />
              <span className="font-medium">{error || success}</span>
              <button onClick={() => {setError(null); setSuccess(null)}} className="ml-auto">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest w-16">Sort</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-widest">Category Name</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <SortableContext 
                    items={categories.map(c => c.id!)}
                    strategy={verticalListSortingStrategy}
                  >
                    {categories.map((category, index) => (
                      <SortableRow 
                        key={category.id} 
                        category={category} 
                        index={index}
                        startEdit={startEdit}
                        handleDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        </div>

        {categories.length === 0 && (
          <div className="text-center py-24 bg-white rounded-[40px] border-2 border-dashed border-gray-100 mt-8">
            <p className="text-gray-400 italic">No categories defined yet. Add one to start ordering!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-2xl font-display font-bold text-ink">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-white rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category Name</label>
                  <input 
                    type="text" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-gray-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-terracotta outline-none font-medium"
                    placeholder="e.g. Smoothie Bowls"
                    required
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-terracotta text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-terracotta/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingCategory ? 'Update' : 'Save Category'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
