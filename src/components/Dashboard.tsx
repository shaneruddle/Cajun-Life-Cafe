import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
const firebaseConfig = { storageBucket: 'cajun-life-cafe.firebasestorage.app' };
import { imageService } from '../services/imageService';
import { MenuItem, Category, OperationType } from '../types';
import { handleFirestoreError } from '../utils/firestore';
import { handleStorageError } from '../utils/storage';
import { normalizeImageUrl } from '../utils/images';
import { logActivity } from '../utils/logger';
import { FirebaseImage } from './ui/FirebaseImage';
import MenuItemCosting from './menu/MenuItemCosting';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X, 
  Check, 
  AlertCircle,
  Globe,
  LayoutGrid,
  Image as ImageIcon,
  Tag,
  Eye,
  EyeOff,
  Bike,
  Upload,
  Download,
  FileText,
  GripVertical,
  Search,
  Filter,
  Trash,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Calculator,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
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
  item: MenuItem;
  startEdit: (item: MenuItem) => void;
  onCosting: (item: MenuItem) => void;
  handleDelete: (id: string) => Promise<void>;
  togglePublished: (item: MenuItem) => Promise<void>;
  toggleDelivery: (item: MenuItem) => Promise<void>;
  costingComplete?: boolean;
}

const SortableRow: React.FC<SortableRowProps> = ({ item, startEdit, handleDelete, togglePublished, toggleDelivery, onCosting, costingComplete }) => {
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
      <td 
        className="px-6 py-4 whitespace-nowrap cursor-pointer group/item"
        onClick={() => startEdit(item)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100 group-hover/item:border-terracotta transition-colors">
            <FirebaseImage 
              src={normalizeImageUrl(item.primaryPhotoPath || item.image)} 
              fallbackSrc="/logo.png"
              alt={item.name} 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <div className="font-bold text-ink group-hover/item:text-terracotta transition-colors">{item.name}</div>
            <div className="text-xs text-gray-400 truncate max-w-[200px]">{item.description}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-3 py-1 bg-cream text-olive rounded-full text-xs font-bold uppercase tracking-wider">
          {item.category}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap font-bold text-terracotta">
        ฿{item.price || '0'}
        {(item.price2 || item.price3 || item.price4) && (
          <span className="ml-1 text-[10px] text-gray-400 font-normal underline decoration-dotted">
            + options
          </span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button 
          onClick={() => togglePublished(item)}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            item.published 
              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          {item.published ? <Eye size={14} /> : <EyeOff size={14} />}
          {item.published ? 'Active' : 'Hidden'}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <button
          onClick={() => toggleDelivery(item)}
          title={item.availableForDelivery === false ? 'Hidden from LINE delivery ordering — click to show' : 'Visible on LINE delivery ordering — click to hide'}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${
            item.availableForDelivery === false
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              : 'bg-olive/10 text-olive hover:bg-olive/20'
          }`}
        >
          <Bike size={14} className={item.availableForDelivery === false ? 'text-red-500' : 'text-green-500'} />
          {item.availableForDelivery === false ? 'Off' : 'On'}
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onCosting(item)}
            className={`p-2 transition-colors ${costingComplete ? 'text-olive hover:text-olive/70' : 'text-gray-400 hover:text-terracotta'}`}
            title={costingComplete ? 'Recipe & Food Cost (Complete)' : 'Recipe & Food Cost'}
          >
            <Calculator size={18} />
          </button>
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

const ImageSlot = ({ 
  label, 
  value, 
  initialValue,
  onUpload, 
  onRemove, 
  onChange, 
  onDownload, 
  onRename,
  uploading 
}: { 
  label: string; 
  value: string; 
  initialValue?: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void> | void; 
  onRemove: () => void; 
  onChange: (val: string) => void; 
  onDownload: () => Promise<void> | void; 
  onRename?: (oldPath: string, newPath: string) => Promise<void> | void;
  uploading: boolean; 
  key?: any;
}) => {
  const hasChanged = initialValue && value !== initialValue && value.startsWith('gs://') && initialValue.startsWith('gs://');

  return (
    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="relative group">
          <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex-shrink-0 border-2 border-dashed border-gray-200 flex items-center justify-center relative shadow-inner">
            {value ? (
              <FirebaseImage 
                src={normalizeImageUrl(value)} 
                fallbackSrc="/logo.png"
                alt="Preview" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-gray-300">
                <ImageIcon size={24} />
                <span className="text-[8px] mt-1 font-bold uppercase">No Image</span>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-terracotta border-t-transparent"></div>
              </div>
            )}
          </div>
          {value && (
            <button 
              type="button"
              onClick={onRemove}
              className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 shadow-md rounded-full p-1 border border-gray-100 transition-colors"
              title="Remove image"
            >
              <X size={12} />
            </button>
          )}
        </div>
        
        <div className="flex-1 w-full space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase text-gray-400 ml-1">{label} Path / URL</label>
              {hasChanged && (
                <button
                  type="button"
                  onClick={() => onRename?.(initialValue, value)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors text-[9px] font-bold"
                  title="Rename file in Firebase Storage to match this new path"
                >
                  <RefreshCw size={10} />
                  <span>Sync Storage</span>
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                <input 
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none text-xs bg-white"
                  placeholder="gs://... or menu-items/..."
                />
              </div>
              {value && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="p-2 bg-white border border-gray-200 rounded-xl hover:text-terracotta transition-colors shadow-sm"
                  title="Download file"
                >
                  <Download size={16} />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className={`flex-1 cursor-pointer bg-white border transition-all px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-sm text-xs font-bold focus-within:ring-2 focus-within:ring-terracotta focus-within:ring-offset-2 ${
              uploading 
                ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400' 
                : 'border-gray-200 hover:border-terracotta hover:bg-gray-50 text-gray-500 hover:text-terracotta active:scale-95'
            }`}>
              <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
              <span>{uploading ? 'Uploading...' : (value ? 'Change Image' : 'Upload Image')}</span>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={onUpload}
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [costingItem, setCostingItem] = useState<MenuItem | null>(null);
  const [costingCompleteIds, setCostingCompleteIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'ipad' | 'iphone'>('ipad');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isSaving, setIsSaving] = useState(false);
  const [isFixingBuckets, setIsFixingBuckets] = useState(false);
  const [isClearingImages, setIsClearingImages] = useState(false);
  const [showTranslationDescriptions, setShowTranslationDescriptions] = useState(false);
  const [initialPaths, setInitialPaths] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    name_chinese: '',
    name_russian: '',
    name_thai: '',
    description: '',
    description_chinese: '',
    description_russian: '',
    description_thai: '',
    price: '',
    priceLabel: '',
    price2: '',
    price2Label: '',
    price3: '',
    price3Label: '',
    price4: '',
    price4Label: '',
    category: 'Smoothie Bowls',
    image: '',
    secondaryImage: '',
    promoImages: [],
    published: true,
    availableForDelivery: true,
    order: 0
  });

  useEffect(() => {
    if (isAdding && !editingItem) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [isAdding, editingItem]);

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

    const q = query(collection(db, 'menu'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const menuItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      setItems(menuItems);
      setLoading(false);
    }, (err) => {
      console.error("Menu snapshot error:", err);
      setLoading(false);
    });

    const categoriesQuery = query(collection(db, 'categories'), orderBy('order', 'asc'));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategoriesList(cats);
    }, (err) => {
      handleFirestoreError(err, 'list', 'categories');
    });

    const unsubscribeRecipes = onSnapshot(collection(db, 'menu_recipes'), (snapshot) => {
      const ids = new Set<string>();
      snapshot.docs.forEach(d => {
        if (d.data().costingComplete === true) ids.add(d.id);
      });
      setCostingCompleteIds(ids);
    });

    return () => {
      unsubscribe();
      unsubscribeCategories();
      unsubscribeRecipes();
      clearTimeout(timer);
    };
  }, []);

  const categories = useMemo(() => {
    // Collect categories from both the dedicated collection AND existing items
    const fromCollection = categoriesList.map(c => c.name);
    const fromItems = items.map(item => item.category);
    
    // Merge, unique, and add "Soup & Salad" if not present
    const allUnique = Array.from(new Set([...fromCollection, ...fromItems]));
    if (!allUnique.includes('Soup & Salad')) {
      allUnique.push('Soup & Salad');
    }
    
    return ['All', ...allUnique.sort()];
  }, [items, categoriesList]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, filterCategory]);

  const fixImageBuckets = async () => {
    if (!window.confirm('This will scan all menu items and update any old image URLs to use your current storage bucket. This helps fix "Permission Denied" errors for images from old projects. Continue?')) return;
    
    setIsFixingBuckets(true);
    let fixedCount = 0;
    try {
      const currentBucket = firebaseConfig.storageBucket || 'cajun-life-cafe.firebasestorage.app';
      const batch = writeBatch(db);
      
      items.forEach(item => {
        let needsUpdate = false;
        const updatedItem: any = {};
        
        const fields: (keyof MenuItem)[] = ['image', 'secondaryImage', 'highResImage', 'socialImage', 'primaryPhotoPath', 'secondaryPhotoPath'];
        fields.forEach(field => {
          const url = item[field] as string;
          if (url && url.startsWith('gs://') && !url.includes(currentBucket)) {
            // Extract path
            const parts = url.split('/');
            const path = parts.slice(3).join('/');
            updatedItem[field] = `gs://${currentBucket}/${path}`;
            needsUpdate = true;
          }
        });
        
        // Handle promoImages array
        if (item.promoImages && Array.isArray(item.promoImages)) {
          const newPromos = item.promoImages.map(url => {
            if (url && url.startsWith('gs://') && !url.includes(currentBucket)) {
              const parts = url.split('/');
              const path = parts.slice(3).join('/');
              needsUpdate = true;
              return `gs://${currentBucket}/${path}`;
            }
            return url;
          });
          if (needsUpdate) updatedItem.promoImages = newPromos;
        }
        
        if (needsUpdate && item.id) {
          batch.update(doc(db, 'menu', item.id), updatedItem);
          fixedCount++;
        }
      });
      
      if (fixedCount > 0) {
        await batch.commit();
        setSuccess(`Successfully updated ${fixedCount} items with correct bucket URLs!`);
        toast.success(`Fixed ${fixedCount} items!`);
      } else {
        setSuccess('All items are already using the correct bucket.');
        toast.info('No items needed fixing.');
      }
    } catch (err) {
      console.error("Fix buckets error:", err);
      setError('Failed to update bucket URLs.');
      toast.error('Failed to fix bucket URLs');
    } finally {
      setIsFixingBuckets(false);
    }
  };

  const clearAllImages = async () => {
    if (!window.confirm('WARNING: This will remove ALL image references from ALL menu items in the database. This is a "Fresh Start" action. Local files in /public/menu will NOT be affected, but the database will no longer point to them. Continue?')) return;
    
    setIsClearingImages(true);
    let clearedCount = 0;
    try {
      const batch = writeBatch(db);
      
      items.forEach(item => {
        if (item.id) {
          batch.update(doc(db, 'menu', item.id), {
            image: '',
            secondaryImage: '',
            highResImage: '',
            socialImage: '',
            primaryPhotoPath: '',
            secondaryPhotoPath: '',
            promoImages: []
          });
          clearedCount++;
        }
      });
      
      if (clearedCount > 0) {
        await batch.commit();
        setSuccess(`Successfully cleared image references for ${clearedCount} items!`);
        toast.success(`Cleared ${clearedCount} items!`);
        imageService.clearCache();
      }
    } catch (err) {
      console.error("Clear images error:", err);
      setError('Failed to clear image references.');
      toast.error('Failed to clear images');
    } finally {
      setIsClearingImages(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex) as MenuItem[];
      setItems(newItems);

      // Persist new order to Firestore
      try {
        const batch = writeBatch(db);
        newItems.forEach((item, index) => {
          if (item.id) {
            const itemRef = doc(db, 'menu', item.id);
            batch.update(itemRef, { order: index });
          }
        });
        await batch.commit();
        setSuccess('Menu order updated!');
      } catch (err) {
        console.error("Error updating order:", err);
        setError('Failed to save new order.');
        handleFirestoreError(err, 'update', 'menu');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      // Clean up formData - remove id and ensure no undefined values
      const { id, ...dataToSave } = formData;
      
      // Ensure all optional fields are at least null if undefined, or just omit them
      // Firestore doesn't like undefined
      const cleanData = Object.fromEntries(
        Object.entries(dataToSave).filter(([_, v]) => v !== undefined)
      );

      if (editingItem?.id) {
        await updateDoc(doc(db, 'menu', editingItem.id), {
          ...cleanData,
          uid: auth.currentUser?.uid || null
        });
        await logActivity('Menu Item Updated', `Updated menu item: ${formData.name}`, 'menu');
        setSuccess('Item updated successfully!');
      } else {
        await addDoc(collection(db, 'menu'), {
          ...cleanData,
          uid: auth.currentUser?.uid || null
        });
        await logActivity('Menu Item Created', `Created menu item: ${formData.name}`, 'menu');
        setSuccess('Item added successfully!');
      }
      resetForm();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Save error:", err);
      setError('Failed to save item. Check permissions.');
      handleFirestoreError(err, editingItem ? 'update' : 'create', 'menu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'menu', id));
      await logActivity('Menu Item Deleted', `Deleted menu item ID: ${id}`, 'menu');
      setSuccess('Item deleted successfully!');
    } catch (err) {
      handleFirestoreError(err, 'delete', `menu/${id}`);
    }
  };

  const togglePublished = async (item: MenuItem) => {
    try {
      await updateDoc(doc(db, 'menu', item.id!), {
        published: !item.published
      });
      await logActivity('Menu Item Visibility Toggled', `${item.published ? 'Unpublished' : 'Published'} menu item: ${item.name}`, 'menu');
    } catch (err) {
      handleFirestoreError(err, 'update', `menu/${item.id}`);
    }
  };

  const toggleDelivery = async (item: MenuItem) => {
    const nowAvailable = item.availableForDelivery === false; // was off, turning on
    try {
      await updateDoc(doc(db, 'menu', item.id!), {
        availableForDelivery: nowAvailable
      });
      await logActivity('Menu Item Delivery Visibility Toggled', `${nowAvailable ? 'Enabled' : 'Disabled'} LINE delivery ordering for menu item: ${item.name}`, 'menu');
    } catch (err) {
      handleFirestoreError(err, 'update', `menu/${item.id}`);
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setIsAdding(false);
    setInitialPaths({});
    setFormData({
      name: '',
      name_chinese: '',
      name_russian: '',
      name_thai: '',
      description: '',
      description_chinese: '',
      description_russian: '',
      description_thai: '',
      price: '',
      priceLabel: '',
      price2: '',
      price2Label: '',
      price3: '',
      price3Label: '',
      price4: '',
      price4Label: '',
      category: 'Smoothie Bowls',
      image: '',
      secondaryImage: '',
      primaryPhotoPath: '',
      secondaryPhotoPath: '',
      highResImage: '',
      socialImage: '',
      promoImages: [],
      published: true,
      order: 0
    });
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-');
  };

  const startEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData(item);
    setInitialPaths({
      image: item.image || '',
      secondaryImage: item.secondaryImage || '',
      primaryPhotoPath: item.primaryPhotoPath || '',
      secondaryPhotoPath: item.secondaryPhotoPath || '',
      highResImage: item.highResImage || '',
      socialImage: item.socialImage || '',
      ...(item.promoImages || []).reduce((acc, url, i) => ({ ...acc, [`promo_${i}`]: url }), {})
    });
    setIsAdding(true);
    // Scroll to form after a short delay to allow it to render
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image' | 'secondaryImage' | 'highResImage' | 'socialImage' | 'promoImages' | 'primaryPhotoPath' | 'secondaryPhotoPath', index?: number) => {
    const file = e.target.files?.[0];
    console.log("File selected:", file?.name, "Size:", file?.size);
    console.log("Current User:", auth.currentUser?.email, "UID:", auth.currentUser?.uid);
    if (!file) return;

    const isHighRes = field === 'highResImage';
    const maxSize = isHighRes ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    const maxSizeLabel = isHighRes ? "50MB" : "20MB";

    if (file.size > maxSize) {
      setError(`File is too large. Please upload an image smaller than ${maxSizeLabel}.`);
      toast.error(`File too large (>${maxSizeLabel})`);
      return;
    }

    if (!formData.name) {
      setError("Please enter an item name before uploading images to ensure correct folder organization.");
      toast.error("Please enter item name first");
      return;
    }

    setUploading(true);
    setError(null);

    let storagePath = '';
    try {
      const itemSlug = slugify(formData.name);
      let fileName = file.name.replace(/\s+/g, '_');
      
      // Use standardized filenames for core slots if possible, or keep original with timestamp
      if (field === 'image') fileName = `primary_${Date.now()}_${fileName}`;
      else if (field === 'primaryPhotoPath') fileName = `direct_primary_${Date.now()}_${fileName}`;
      else if (field === 'secondaryPhotoPath') fileName = `direct_secondary_${Date.now()}_${fileName}`;
      else if (field === 'secondaryImage') fileName = `secondary_${Date.now()}_${fileName}`;
      else if (field === 'highResImage') fileName = `highres_${Date.now()}_${fileName}`;
      else if (field === 'socialImage') fileName = `social_${Date.now()}_${fileName}`;
      else if (field === 'promoImages') fileName = `promo_${index ?? Date.now()}_${fileName}`;

      storagePath = `menu-items/${itemSlug}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      console.log(`Uploading to: ${storagePath}`);
      console.log("Storage Instance Bucket:", storage.app.options.storageBucket);
      console.log("Auth State:", auth.currentUser ? "Logged In" : "Logged Out");
      
      // Upload the file
      await uploadBytes(storageRef, file);
      
      // Get the gs:// URL
      const bucket = firebaseConfig.storageBucket || storage.app.options.storageBucket || 'cajun-life-cafe.firebasestorage.app';
      console.log("Using Storage Bucket:", bucket);
      const gsUrl = `gs://${bucket}/${storagePath}`;
      
      console.log(`Upload successful. GS URL: ${gsUrl}`);
      
      // Clear cache just in case, though unique filename should handle it
      imageService.clearCache(gsUrl);
      
      // Update initialPaths so Sync button doesn't show for fresh upload
      setInitialPaths(prev => {
        const key = field === 'promoImages' && typeof index === 'number' ? `promo_${index}` : field;
        return { ...prev, [key]: gsUrl };
      });

      if (field === 'promoImages' && typeof index === 'number') {
        setFormData(prev => {
          const newPromos = [...(prev.promoImages || [])];
          newPromos[index] = gsUrl;
          return { ...prev, promoImages: newPromos };
        });
      } else if (field === 'promoImages') {
        setFormData(prev => ({ 
          ...prev, 
          promoImages: [...(prev.promoImages || []), gsUrl] 
        }));
      } else {
        setFormData(prev => ({ ...prev, [field]: gsUrl }));
      }
      setSuccess('File uploaded successfully!');
      toast.success('Image uploaded successfully!');
    } catch (err: any) {
      console.error("Upload error details:", err);
      const storageError = handleStorageError(err, 'upload', storagePath || 'unknown');
      const errorMessage = err.message || 'Unknown error';
      setError(`Failed to upload file: ${errorMessage}. Check storage permissions in Firebase Console.`);
      toast.error(`Upload failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (gsUrl: string) => {
    if (!gsUrl) return;
    try {
      let downloadUrl = gsUrl;
      if (gsUrl.startsWith('gs://')) {
        // More robust path extraction: gs://bucket/path/to/file
        const path = gsUrl.split('/').slice(3).join('/');
        downloadUrl = await getDownloadURL(ref(storage, path));
      } else if (gsUrl.startsWith('/')) {
        downloadUrl = window.location.origin + gsUrl;
      }
      
      try {
        const response = await fetch(downloadUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const fileName = gsUrl.split('/').pop() || 'download';
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } catch (fetchErr) {
        console.warn("Fetch download failed, falling back to direct link", fetchErr);
        // Fallback: open in new tab
        window.open(downloadUrl, '_blank');
      }
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download file. It might be a permissions issue or the file doesn't exist.");
    }
  };

  const handleRenameFile = async (oldGsUrl: string, newGsUrl: string, field: 'image' | 'secondaryImage' | 'highResImage' | 'socialImage' | 'promoImages' | 'primaryPhotoPath' | 'secondaryPhotoPath', index?: number) => {
    if (!oldGsUrl || !newGsUrl || oldGsUrl === newGsUrl) return;
    if (!oldGsUrl.startsWith('gs://') || !newGsUrl.startsWith('gs://')) {
      setError("Only gs:// paths can be renamed in storage.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      // Extract paths from gs:// URLs
      const oldPath = oldGsUrl.replace('gs://', '').split('/').slice(1).join('/');
      const newPath = newGsUrl.replace('gs://', '').split('/').slice(1).join('/');
      
      const oldRef = ref(storage, oldPath);
      const newRef = ref(storage, newPath);

      // 1. Get download URL
      const downloadUrl = await getDownloadURL(oldRef);
      
      // 2. Fetch blob
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      
      // 3. Upload to new location
      await uploadBytes(newRef, blob);
      
      // 4. Delete old file
      await deleteObject(oldRef);
      
      // Update initialPaths so the sync button disappears
      setInitialPaths(prev => {
        const key = field === 'promoImages' ? `promo_${index}` : field;
        return { ...prev, [key]: newGsUrl };
      });
      
      setSuccess(`File successfully moved in storage to: ${newPath}`);
    } catch (err) {
      console.error("Rename error:", err);
      setError("Failed to rename file in storage. Make sure the old file exists and you have permissions.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cream">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-terracotta"></div>
    </div>
  );

  return (
    <>
    <div className="min-h-screen bg-cream p-6 md:p-12 relative z-0 pt-8">
      <div className="max-w-6xl mx-auto mt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-24 gap-10">
          <div>
            <h1 className="text-4xl font-display font-bold text-ink">Menu Dashboard</h1>
            <p className="text-gray-500 mt-2">Manage your restaurant's menu items and translations.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link 
              to="/dashboard/custom-meals"
              className="flex items-center gap-2 px-6 py-2 bg-white text-ink border border-gray-200 rounded-full hover:bg-gray-50 transition-all text-sm font-medium shadow-sm"
            >
              <LayoutGrid size={18} className="text-terracotta" /> Custom Meals
            </Link>
            <button 
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-6 py-2 bg-white text-ink border border-gray-200 rounded-full hover:bg-gray-50 transition-all text-sm font-medium shadow-sm"
            >
              <Eye size={18} className="text-terracotta" /> Live Preview
            </button>
            <button 
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-2 px-6 py-2 bg-terracotta text-white rounded-full hover:bg-opacity-90 transition-all text-sm font-medium shadow-lg"
            >
              <Plus size={18} /> Add New Item
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 rounded-r-lg">
            <AlertCircle size={20} />
            <div className="flex-1">
              <p className="font-bold">Error</p>
              <p className="text-sm">{error}</p>
              {!auth.currentUser && (
                <p className="mt-2 text-xs font-bold text-red-800">
                  ⚠️ You are currently LOGGED OUT. Storage uploads require authentication. Please login using the Admin Login button above.
                </p>
              )}
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center gap-3 rounded-r-lg">
            <Check size={20} />
            <p>{success}</p>
          </div>
        )}

        <AnimatePresence>
          {showPreview && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-12 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bg-white transition-all duration-500 rounded-[32px] overflow-hidden flex flex-col shadow-2xl ${
                  previewDevice === 'ipad' 
                    ? 'w-full max-w-5xl h-[90vh] md:h-full' 
                    : 'w-[390px] h-[844px] max-h-[95vh]'
                }`}
              >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white">
                  <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg">Digital Menu Preview</h3>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button 
                        onClick={() => setPreviewDevice('ipad')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          previewDevice === 'ipad' 
                            ? 'bg-white shadow-sm text-terracotta' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        iPad
                      </button>
                      <button 
                        onClick={() => setPreviewDevice('iphone')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          previewDevice === 'iphone' 
                            ? 'bg-white shadow-sm text-terracotta' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        iPhone
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link 
                      to="/digital-menu" 
                      target="_blank"
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-terracotta"
                      title="Open in new tab"
                    >
                      <Globe size={20} />
                    </Link>
                    <button 
                      onClick={() => setShowPreview(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 bg-gray-100 p-4 md:p-8 overflow-hidden flex items-center justify-center">
                  <div className={`bg-white rounded-2xl shadow-inner overflow-hidden border border-gray-200 transition-all duration-500 ${
                    previewDevice === 'ipad' ? 'w-full h-full' : 'w-full h-full'
                  }`}>
                    <iframe 
                      src={`${window.location.origin}/digital-menu?preview=true`} 
                      className="w-full h-full border-none"
                      title="Digital Menu Preview"
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAdding && (
            <motion.div 
              ref={formRef}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-[32px] shadow-xl p-8 mb-12 border border-gray-100"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-display font-bold text-ink">
                  {editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}
                </h2>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                      <Globe size={14} /> English Name *
                    </label>
                    <input 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                      placeholder="e.g. Mixed Berry Smoothie Bowl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase tracking-wider text-gray-400">English Description</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none h-24"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                        <span className="text-[14px] font-bold leading-none">฿</span> Price (in THB) *
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            value={formData.priceLabel}
                            onChange={e => setFormData({...formData, priceLabel: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
                            placeholder="Primary Label (e.g. Small)"
                          />
                          <input 
                            required
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                            placeholder="Primary Price"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            value={formData.price2Label}
                            onChange={e => setFormData({...formData, price2Label: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
                            placeholder="Label 2"
                          />
                          <input 
                            value={formData.price2}
                            onChange={e => setFormData({...formData, price2: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                            placeholder="Price 2"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            value={formData.price3Label}
                            onChange={e => setFormData({...formData, price3Label: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
                            placeholder="Label 3"
                          />
                          <input 
                            value={formData.price3}
                            onChange={e => setFormData({...formData, price3: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                            placeholder="Price 3"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            value={formData.price4Label}
                            onChange={e => setFormData({...formData, price4Label: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
                            placeholder="Label 4"
                          />
                          <input 
                            value={formData.price4}
                            onChange={e => setFormData({...formData, price4: e.target.value})}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                            placeholder="Price 4"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                        <Tag size={14} /> Category *
                      </label>
                      <select 
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none bg-white font-medium text-ink transition-all hover:border-terracotta/50"
                      >
                        {categories.filter(c => c !== 'All').map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-ink flex items-center gap-2">
                        {formData.published ? <Eye size={18} className="text-green-500" /> : <EyeOff size={18} className="text-gray-400" />}
                        Menu Visibility
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.published 
                          ? "This item is currently visible on the digital menu." 
                          : "This item is hidden from the digital menu."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, published: !formData.published})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        formData.published ? 'bg-terracotta' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.published ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-ink flex items-center gap-2">
                        <Bike size={18} className={formData.availableForDelivery === false ? 'text-red-500' : 'text-green-500'} />
                        LINE Delivery Ordering
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {formData.availableForDelivery === false
                          ? "Hidden from the LINE delivery ordering page — still shown on the in-house/QR digital menu."
                          : "Available to order through the LINE delivery ordering page."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, availableForDelivery: formData.availableForDelivery === false})}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        formData.availableForDelivery === false ? 'bg-gray-200' : 'bg-olive'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          formData.availableForDelivery === false ? 'translate-x-1' : 'translate-x-6'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Translations */}
                <div className="space-y-6 bg-gray-50 p-6 rounded-3xl">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Globe size={20} className="text-terracotta" /> Translations
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-gray-400">Chinese Name</label>
                      <input 
                        value={formData.name_chinese}
                        onChange={e => setFormData({...formData, name_chinese: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-gray-400">Russian Name</label>
                      <input 
                        value={formData.name_russian}
                        onChange={e => setFormData({...formData, name_russian: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-gray-400">Thai Name</label>
                      <input 
                        value={formData.name_thai}
                        onChange={e => setFormData({...formData, name_thai: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none"
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-200 mt-2">
                      <button
                        type="button"
                        onClick={() => setShowTranslationDescriptions(!showTranslationDescriptions)}
                        className="flex items-center justify-between w-full text-xs font-bold uppercase text-gray-400 hover:text-terracotta transition-colors"
                      >
                        <span>Translation Descriptions</span>
                        {showTranslationDescriptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      
                      <AnimatePresence>
                        {showTranslationDescriptions && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden space-y-4 mt-4"
                          >
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase text-gray-400">Chinese Description</label>
                              <textarea 
                                value={formData.description_chinese}
                                onChange={e => setFormData({...formData, description_chinese: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none h-20 text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase text-gray-400">Russian Description</label>
                              <textarea 
                                value={formData.description_russian}
                                onChange={e => setFormData({...formData, description_russian: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none h-20 text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold uppercase text-gray-400">Thai Description</label>
                              <textarea 
                                value={formData.description_thai}
                                onChange={e => setFormData({...formData, description_thai: e.target.value})}
                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-terracotta outline-none h-20 text-sm"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Media Management */}
                <div className="md:col-span-2 space-y-8 bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-display font-bold text-ink flex items-center gap-2">
                      <ImageIcon size={24} className="text-terracotta" /> Media Management
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {uploading && <span className="text-terracotta animate-pulse">Uploading in progress...</span>}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Primary Photo (Optimized WebP) */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink uppercase tracking-wider">1) Primary Photo Path (Priority)</h4>
                        <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-0.5 rounded">Exact Path</span>
                      </div>
                      <ImageSlot
                        label="Primary Path"
                        value={formData.primaryPhotoPath || ''}
                        initialValue={initialPaths.primaryPhotoPath}
                        onUpload={(e) => handleFileUpload(e, 'primaryPhotoPath')}
                        onRemove={() => setFormData(prev => ({ ...prev, primaryPhotoPath: '' }))}
                        onChange={(val) => setFormData(prev => ({ ...prev, primaryPhotoPath: val }))}
                        onDownload={() => handleDownload(formData.primaryPhotoPath || '')}
                        onRename={(old, curr) => handleRenameFile(old, curr, 'primaryPhotoPath')}
                        uploading={uploading}
                      />
                    </div>

                    {/* Legacy Primary Photo */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink uppercase tracking-wider">2) Legacy Image Field (Fallback)</h4>
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded">Legacy</span>
                      </div>
                      <ImageSlot
                        label="Legacy Image"
                        value={formData.image || ''}
                        initialValue={initialPaths.image}
                        onUpload={(e) => handleFileUpload(e, 'image')}
                        onRemove={() => setFormData(prev => ({ ...prev, image: '' }))}
                        onChange={(val) => setFormData(prev => ({ ...prev, image: val }))}
                        onDownload={() => handleDownload(formData.image || '')}
                        onRename={(old, curr) => handleRenameFile(old, curr, 'image')}
                        uploading={uploading}
                      />
                    </div>

                    {/* Secondary Photo Path */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink uppercase tracking-wider">3) Secondary Photo Path</h4>
                        <span className="text-[10px] font-bold text-terracotta bg-terracotta/5 px-2 py-0.5 rounded">Exact Path</span>
                      </div>
                      <ImageSlot
                        label="Secondary Path"
                        value={formData.secondaryPhotoPath || ''}
                        initialValue={initialPaths.secondaryPhotoPath}
                        onUpload={(e) => handleFileUpload(e, 'secondaryPhotoPath')}
                        onRemove={() => setFormData(prev => ({ ...prev, secondaryPhotoPath: '' }))}
                        onChange={(val) => setFormData(prev => ({ ...prev, secondaryPhotoPath: val }))}
                        onDownload={() => handleDownload(formData.secondaryPhotoPath || '')}
                        onRename={(old, curr) => handleRenameFile(old, curr, 'secondaryPhotoPath')}
                        uploading={uploading}
                      />
                    </div>

                    {/* High-Res Source */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink uppercase tracking-wider">4) High-Res Source</h4>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Original Quality</span>
                      </div>
                      <ImageSlot
                        label="High-Res"
                        value={formData.highResImage || ''}
                        initialValue={initialPaths.highResImage}
                        onUpload={(e) => handleFileUpload(e, 'highResImage')}
                        onRemove={() => setFormData(prev => ({ ...prev, highResImage: '' }))}
                        onChange={(val) => setFormData(prev => ({ ...prev, highResImage: val }))}
                        onDownload={() => handleDownload(formData.highResImage || '')}
                        onRename={(old, curr) => handleRenameFile(old, curr, 'highResImage')}
                        uploading={uploading}
                      />
                    </div>

                    {/* Social Media Graphic */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-ink uppercase tracking-wider">5) Social Graphic</h4>
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Instagram/FB</span>
                      </div>
                      <ImageSlot
                        label="Social"
                        value={formData.socialImage || ''}
                        initialValue={initialPaths.socialImage}
                        onUpload={(e) => handleFileUpload(e, 'socialImage')}
                        onRemove={() => setFormData(prev => ({ ...prev, socialImage: '' }))}
                        onChange={(val) => setFormData(prev => ({ ...prev, socialImage: val }))}
                        onDownload={() => handleDownload(formData.socialImage || '')}
                        onRename={(old, curr) => handleRenameFile(old, curr, 'socialImage')}
                        uploading={uploading}
                      />
                    </div>
                  </div>

                  {/* Promotional Materials */}
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-ink uppercase tracking-wider">6) Promotional Materials</h4>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, promoImages: [...(prev.promoImages || []), ''] }))}
                        className="text-xs font-bold text-terracotta hover:bg-terracotta/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Spot
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {formData.promoImages?.map((url, index) => (
                        <ImageSlot
                          key={index}
                          label={`Promo ${index + 1}`}
                          value={url}
                          initialValue={initialPaths[`promo_${index}`]}
                          onUpload={(e) => handleFileUpload(e, 'promoImages', index)}
                          onRemove={() => {
                            const newPromos = [...(formData.promoImages || [])];
                            newPromos.splice(index, 1);
                            setFormData({ ...formData, promoImages: newPromos });
                          }}
                          onChange={(val) => {
                            const newPromos = [...(formData.promoImages || [])];
                            newPromos[index] = val;
                            setFormData({ ...formData, promoImages: newPromos });
                          }}
                          onDownload={() => handleDownload(url)}
                          onRename={(old, curr) => handleRenameFile(old, curr, 'promoImages', index)}
                          uploading={uploading}
                        />
                      ))}
                      {(!formData.promoImages || formData.promoImages.length === 0) && (
                        <div className="col-span-full py-12 border-2 border-dashed border-gray-100 rounded-3xl flex flex-col items-center justify-center text-gray-300 bg-gray-50/50">
                          <ImageIcon size={40} />
                          <p className="text-xs font-bold uppercase mt-3 tracking-widest">No Promotional Materials Uploaded</p>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, promoImages: [''] }))}
                            className="mt-4 text-xs font-bold text-terracotta border border-terracotta px-4 py-2 rounded-full hover:bg-terracotta hover:text-white transition-all"
                          >
                            Add First Spot
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                  <button 
                    type="button"
                    onClick={resetForm}
                    className="px-8 py-3 rounded-full font-medium border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving || uploading}
                    className={`terracotta-button flex items-center gap-2 ${(isSaving || uploading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <Save size={18} />
                    )}
                    {isSaving ? 'Saving...' : (editingItem ? 'Update Item' : 'Save Item')}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Search items by name, description or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="text-gray-400" size={18} />
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="flex-1 md:w-48 px-4 py-2 rounded-xl border border-gray-100 focus:ring-2 focus:ring-terracotta outline-none bg-gray-50/50 font-medium text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

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
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Item</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Category</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Price</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Delivery</th>
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
                    onCosting={setCostingItem}
                        handleDelete={handleDelete}
                        togglePublished={togglePublished}
                        toggleDelivery={toggleDelivery}
                        costingComplete={costingCompleteIds.has(item.id!)}
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

      {costingItem && (
        <MenuItemCosting item={costingItem} onClose={() => setCostingItem(null)} />
      )}
    </>
  );
}
