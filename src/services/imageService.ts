import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * ImageService: A robust service for resolving image URLs from various sources.
 * It handles Firebase Storage (gs://), local assets, and full URLs.
 * It also provides fallback logic for common image extensions.
 */
export class ImageService {
  private static instance: ImageService;
  private cache: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  /**
   * Resolves a source string into a usable URL.
   * @param src The source string (filename, gs:// URL, or full URL)
   * @returns A promise that resolves to the final URL
   */
  public async resolve(src: string | undefined): Promise<string> {
    if (!src) return '/logo.png';
    
    const trimmedSrc = src.trim();
    if (trimmedSrc === '' || trimmedSrc === 'logo.png' || trimmedSrc === '/logo.png') return '/logo.png';

    // 1. Check cache
    if (this.cache.has(trimmedSrc)) {
      return this.cache.get(trimmedSrc)!;
    }
    
    return this.resolveNoCache(trimmedSrc);
  }

  /**
   * Resolves a source without checking the cache first, but populates it.
   */
  public async resolveNoCache(src: string): Promise<string> {
    const trimmedSrc = src.trim();
    
    // 2. Handle full URLs
    if (trimmedSrc.startsWith('http') || trimmedSrc.startsWith('data:') || trimmedSrc.startsWith('//')) {
      const url = trimmedSrc.startsWith('//') ? `https:${trimmedSrc}` : trimmedSrc;
      this.cache.set(src, url);
      return url;
    }

    // 3. Handle Firebase Storage (gs://)
    if (trimmedSrc.startsWith('gs://')) {
      // Extract the path from the gs:// URL
      // Format is gs://bucket-name/path/to/file
      const parts = trimmedSrc.split('/');
      if (parts.length >= 4) {
        let path = parts.slice(3).join('/');
        
        // Fix common encoding issues like -20 instead of %20 or spaces
        path = path.replace(/-20/g, ' ').replace(/%20/g, ' ');
        
        try {
          // ALWAYS try to resolve using the CURRENT configured bucket first
          // ref(storage, path) uses the storage instance which is already bound to the correct bucket
          const storageRef = ref(storage, path);
          const url = await getDownloadURL(storageRef);
          this.cache.set(src, url);
          return url;
        } catch (error: any) {
          console.warn(`ImageService: Failed to resolve path "${path}" in current bucket. Error: ${error?.code || error?.message}`);
          
          // If it failed and was in the old "menu/" folder, try the new "menu-items/" structure
          // but we don't know the slug here easily. 
          // However, we can try to see if the file exists directly in menu-items/
          if (path.startsWith('menu/')) {
            const fileName = path.split('/').pop();
            if (fileName) {
              try {
                // Try a few common locations
                const altPaths = [
                  `menu-items/${fileName}`,
                  `menu-items/${fileName.replace(/\s+/g, '-')}`,
                  `menu-items/${fileName.replace(/\s+/g, '_')}`
                ];
                
                for (const altPath of altPaths) {
                  try {
                    const altRef = ref(storage, altPath);
                    const url = await getDownloadURL(altRef);
                    this.cache.set(src, url);
                    return url;
                  } catch (e) {}
                }
              } catch (e) {}
            }
          }

          // Try with encoded path if it was different
          const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
          if (encodedPath !== path) {
            try {
              const encodedRef = ref(storage, encodedPath);
              const url = await getDownloadURL(encodedRef);
              this.cache.set(src, url);
              return url;
            } catch (e) {}
          }
        }
      }
      
      // Fallback: try to treat the filename part as a local asset
      let filename = trimmedSrc.split('/').pop() || '';
      if (filename) {
        // Fix -20 and other common issues in filename
        filename = filename.replace(/-20/g, ' ').replace(/%20/g, ' ');
        return this.resolveLocal(decodeURIComponent(filename));
      }
    }

    // 4. Handle local assets or filenames
    // For local assets, we decode just in case they were stored encoded
    const decodedSrc = decodeURIComponent(trimmedSrc);
    const localUrl = await this.resolveLocal(decodedSrc);
    this.cache.set(src, localUrl);
    return localUrl;
  }

  /**
   * Clears the cache for a specific source or all sources.
   */
  public clearCache(src?: string): void {
    if (src) {
      const trimmedSrc = decodeURIComponent(src.trim());
      this.cache.delete(trimmedSrc);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Resolves a local filename or path, trying multiple extensions if needed.
   */
  private async resolveLocal(path: string): Promise<string> {
    // Remove any leading slashes and trim
    let cleanPath = path.trim().replace(/^\/+/, '');
    
    // Fix common encoding issues like -20 instead of spaces
    cleanPath = cleanPath.replace(/-20/g, ' ').replace(/%20/g, ' ');
    
    // Special case for logo
    if (cleanPath === 'logo.png' || cleanPath === 'logo' || cleanPath === '') {
      return '/logo.png';
    }

    // If it's already a full path to a menu item
    if (cleanPath.startsWith('menu/')) {
      // Try to see if it exists in Firebase Storage first
      try {
        const storageRef = ref(storage, cleanPath);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch (e) {
        // Fallback to local path
        return `/${cleanPath}`;
      }
    }

    // If it's just a filename, assume it's in /menu/
    if (!cleanPath.includes('/')) {
      // We'll try common extensions and also handle case-sensitivity issues
      // by providing alternatives in getAlternativePaths
      const filename = cleanPath.includes('.') ? cleanPath : `${cleanPath}.jpg`;
      
      // Try with spaces first (if any)
      const storagePath = `menu/${filename}`;
      // Also try with hyphens instead of spaces as a common convention
      const hyphenatedPath = `menu/${filename.replace(/\s+/g, '-')}`;
      
      try {
        const storageRef = ref(storage, storagePath);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch (e) {
        if (hyphenatedPath !== storagePath) {
          try {
            const hyphenatedRef = ref(storage, hyphenatedPath);
            const url = await getDownloadURL(hyphenatedRef);
            return url;
          } catch (e2) {}
        }
        // Fallback to local path
        return `/menu/${filename}`;
      }
    }

    // For any other path, just ensure it has a leading slash
    return `/${cleanPath}`;
  }

  /**
   * Helper to try alternative extensions and cases for a local path.
   * This is used by the component when an image fails to load.
   */
  public getAlternativePaths(currentPath: string): string[] {
    if (!currentPath.startsWith('/menu/') && currentPath !== '/logo.png') return [];

    const extensions = ['.jpg', '.png', '.webp', '.jpeg', '.JPG', '.PNG', '.WEBP', '.JPEG'];
    const lastDotIndex = currentPath.lastIndexOf('.');
    
    let basePath: string;
    let currentExt: string;

    if (lastDotIndex === -1) {
      basePath = currentPath;
      currentExt = '';
    } else {
      currentExt = currentPath.substring(lastDotIndex);
      basePath = currentPath.substring(0, lastDotIndex);
    }

    const alts = new Set<string>();
    
    // Try different extensions
    extensions.forEach(ext => {
      if (ext.toLowerCase() !== currentExt.toLowerCase()) {
        alts.add(`${basePath}${ext}`);
      }
    });

    // Try case variations of the current extension if it exists
    if (currentExt) {
      const upperExt = currentExt.toUpperCase();
      const lowerExt = currentExt.toLowerCase();
      if (upperExt !== currentExt) alts.add(`${basePath}${upperExt}`);
      if (lowerExt !== currentExt) alts.add(`${basePath}${lowerExt}`);
    }

    return Array.from(alts);
  }
}

export const imageService = ImageService.getInstance();
