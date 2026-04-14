import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Copy, 
  Check, 
  Search,
  Filter,
  ExternalLink,
  Loader2,
  Plus,
  Edit2,
  Save,
  X as CloseIcon
} from 'lucide-react';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  listAll, 
  deleteObject,
  getMetadata,
  uploadBytes,
  getBytes,
  getBlob
} from 'firebase/storage';
import { storage, auth } from '../firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { logActivity } from '../utils/logger';

interface StoredImage {
  name: string;
  fullPath: string;
  url: string;
  size: number;
  contentType: string;
  timeCreated: string;
}

export default function ImageManagement() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState('assets');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const folders = [
    { id: 'assets', label: 'General Assets', path: 'assets' },
    { id: 'logos', label: 'Logos', path: 'logos' },
    { id: 'promo', label: 'Promotions', path: 'promotions' },
    { id: 'menu-items', label: 'Menu Items', path: 'menu-items' },
  ];

  const fetchImages = async () => {
    setLoading(true);
    try {
      const folderRef = ref(storage, selectedFolder);
      const result = await listAll(folderRef);
      
      const imagePromises = result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        const metadata = await getMetadata(item);
        return {
          name: item.name,
          fullPath: item.fullPath,
          url,
          size: metadata.size,
          contentType: metadata.contentType || 'image/jpeg',
          timeCreated: metadata.timeCreated,
        };
      });

      const imageData = await Promise.all(imagePromises);
      setImages(imageData.sort((a, b) => new Date(b.timeCreated).getTime() - new Date(a.timeCreated).getTime()));
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [selectedFolder]);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^-+|-+$/g, '');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit size to 20MB for general assets
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File too large (>20MB)');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const storagePath = `${selectedFolder}/${fileName}`;
      const storageRef = ref(storage, storagePath);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        }, 
        (error) => {
          console.error('Upload error:', error);
          toast.error('Upload failed: ' + error.message);
          setUploading(false);
        }, 
        async () => {
          await logActivity('Image Uploaded', `Uploaded image: ${file.name} to ${selectedFolder}`, 'image');
          toast.success('Image uploaded successfully');
          setUploading(false);
          fetchImages();
        }
      );
    } catch (error) {
      console.error('Error starting upload:', error);
      toast.error('Failed to start upload');
      setUploading(false);
    }
  };

  const handleDelete = async (image: StoredImage) => {
    if (!window.confirm(`Are you sure you want to delete ${image.name}?`)) return;

    try {
      const imageRef = ref(storage, image.fullPath);
      await deleteObject(imageRef);
      await logActivity('Image Deleted', `Deleted image: ${image.name} from ${image.fullPath}`, 'image');
      toast.success('Image deleted');
      setImages(images.filter(img => img.fullPath !== image.fullPath));
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleRename = async (image: StoredImage) => {
    let inputName = newName.trim();
    if (!inputName || inputName === image.name) {
      setEditingImage(null);
      return;
    }

    // Derive filename from title (slugify)
    const originalExt = image.name.split('.').pop();
    let trimmedName = inputName;

    // If the user didn't provide an extension, slugify the whole thing and add original extension
    if (!trimmedName.includes('.')) {
      trimmedName = `${slugify(trimmedName)}.${originalExt}`;
    } else {
      // If they provided an extension, slugify the name part and keep their extension
      const parts = trimmedName.split('.');
      const ext = parts.pop();
      const namePart = parts.join('.');
      trimmedName = `${slugify(namePart)}.${ext}`;
    }

    if (trimmedName === image.name) {
      setEditingImage(null);
      return;
    }

    // Check if name already exists in current folder
    if (images.some(img => img.name.toLowerCase() === trimmedName.toLowerCase() && img.fullPath !== image.fullPath)) {
      toast.error('An image with this name already exists in this folder');
      return;
    }

    setRenaming(true);
    const toastId = toast.loading(`Renaming to ${trimmedName}...`);
    
    try {
      // 1. Get the file data directly from storage
      const oldRef = ref(storage, image.fullPath);
      
      let blob;
      try {
        // Use getBlob for better compatibility
        blob = await getBlob(oldRef, 20 * 1024 * 1024); // 20MB limit
      } catch (downloadError: any) {
        console.warn('getBlob failed, trying getBytes fallback', downloadError);
        const buffer = await getBytes(oldRef, 20 * 1024 * 1024);
        blob = new Blob([buffer], { type: image.contentType });
      }

      // 2. Upload with new name
      // Derive folder from fullPath instead of relying on selectedFolder state
      const pathParts = image.fullPath.split('/');
      pathParts.pop(); // remove filename
      const folderPath = pathParts.join('/');
      const newPath = folderPath ? `${folderPath}/${trimmedName}` : trimmedName;
      
      const newRef = ref(storage, newPath);
      await uploadBytes(newRef, blob, { 
        contentType: image.contentType,
        customMetadata: {
          renamedFrom: image.name,
          renamedAt: new Date().toISOString()
        }
      });

      // 3. Delete old file
      try {
        await deleteObject(oldRef);
      } catch (deleteError: any) {
        console.error('Error deleting old file during rename:', deleteError);
        toast.warning('New file created, but old file could not be deleted. You may have a duplicate.', { id: toastId });
      }

      // 4. Get new metadata and URL for immediate state update
      const [newUrl, newMetadata] = await Promise.all([
        getDownloadURL(newRef),
        getMetadata(newRef)
      ]);

      const updatedImage: StoredImage = {
        name: trimmedName,
        fullPath: newPath,
        url: newUrl,
        size: newMetadata.size,
        contentType: newMetadata.contentType || image.contentType,
        timeCreated: newMetadata.timeCreated,
      };

      // 5. Update local state immediately for better UX
      setImages(prev => prev.map(img => img.fullPath === image.fullPath ? updatedImage : img));
      
      await logActivity('Image Renamed', `Renamed image: ${image.name} to ${trimmedName} in ${folderPath}`, 'image');
      toast.success('Image renamed successfully', { id: toastId });
      setEditingImage(null);
    } catch (error: any) {
      console.error('Error renaming image:', error);
      
      let errorMessage = error.message || 'Unknown error';
      if (error.code === 'storage/retry-limit-exceeded') {
        errorMessage = 'Connection timed out. This is usually caused by missing CORS configuration on your Firebase Storage bucket. Please check the instructions I provided in the chat to fix this.';
      } else if (error.code === 'storage/object-not-found') {
        errorMessage = 'Original image not found. It may have been moved or deleted.';
      } else if (error.code === 'storage/unauthorized') {
        errorMessage = 'You do not have permission to rename this image. Check your storage rules.';
      } else if (error.message?.includes('CORS')) {
        errorMessage = 'CORS error: The storage bucket is not configured to allow downloads from this domain.';
      }

      toast.error(`Failed to rename: ${errorMessage}`, { id: toastId, duration: 6000 });
      // Refresh list in case of error to ensure sync
      fetchImages();
    } finally {
      setRenaming(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(text);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const filteredImages = images.filter(img => 
    img.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-ink">Image Management</h1>
          <p className="text-gray-500 mt-2">Upload and manage general assets, logos, and promotional images.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className={`flex items-center gap-2 px-6 py-3 bg-terracotta text-white rounded-full hover:bg-terracotta/90 transition-all cursor-pointer shadow-lg shadow-terracotta/20 font-medium ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            {uploading ? `Uploading ${Math.round(uploadProgress)}%` : 'Upload New Image'}
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </header>

      {/* Folders & Search */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          <div className="flex flex-wrap gap-2">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.path)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedFolder === folder.path 
                    ? 'bg-terracotta text-white shadow-md' 
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
              >
                {folder.label}
              </button>
            ))}
          </div>
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search images by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-terracotta/20 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Image Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin mb-4" size={40} />
          <p>Loading storage assets...</p>
        </div>
      ) : filteredImages.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredImages.map((image) => (
              <motion.div
                key={image.fullPath}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className="aspect-square relative bg-gray-50 overflow-hidden">
                  <img 
                    src={image.url} 
                    alt={image.name}
                    className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => copyToClipboard(image.url)}
                      className="p-3 bg-white rounded-full text-ink hover:bg-terracotta hover:text-white transition-all shadow-lg"
                      title="Copy URL"
                    >
                      {copiedPath === image.url ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-white rounded-full text-ink hover:bg-terracotta hover:text-white transition-all shadow-lg"
                      title="Open Original"
                    >
                      <ExternalLink size={20} />
                    </a>
                    <button
                      onClick={() => handleDelete(image)}
                      className="p-3 bg-white rounded-full text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-lg"
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="p-4">
                  {editingImage === image.fullPath ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New Title..."
                        className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-terracotta outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(image);
                          if (e.key === 'Escape') setEditingImage(null);
                        }}
                      />
                      <button 
                        onClick={() => handleRename(image)}
                        disabled={renaming}
                        className="text-terracotta hover:text-terracotta/80 disabled:opacity-50"
                      >
                        {renaming ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      </button>
                      <button 
                        onClick={() => setEditingImage(null)}
                        disabled={renaming}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <CloseIcon size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group/name">
                      <p className="font-medium text-ink truncate text-sm flex-1" title={image.name}>
                        {image.name}
                      </p>
                      <button
                        onClick={() => {
                          setEditingImage(image.fullPath);
                          setNewName(image.name);
                        }}
                        className="opacity-0 group-hover/name:opacity-100 p-1 text-gray-400 hover:text-terracotta transition-all"
                        title="Rename"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    <span>{formatSize(image.size)}</span>
                    <span>{new Date(image.timeCreated).toLocaleDateString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300">
            <ImageIcon size={32} />
          </div>
          <h3 className="text-lg font-bold text-ink mb-2">No images found</h3>
          <p className="text-gray-500 max-w-xs mx-auto">
            {searchQuery ? `No images match "${searchQuery}" in this folder.` : 'Upload your first image to this folder to see it here.'}
          </p>
        </div>
      )}
    </div>
  );
}
