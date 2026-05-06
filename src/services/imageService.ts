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
      const parts = trimmedSrc.split('/');
      if (parts.length >= 4) {
        // Extract the path after gs://bucket/
        let path = parts.slice(3).join('/');
        path = path.replace(/-20/g, ' ').replace(/%20/g, ' ');
        
        try {
          const storageRef = ref(storage, path);
          const url = await getDownloadURL(storageRef);
          this.cache.set(src, url);
          return url;
        } catch (error) {
          console.warn(`ImageService: Failed to resolve gsUrl "${trimmedSrc}" as "${path}". Fallback to logo.`);
          return '/logo.png';
        }
      }
    }

    // 4. Handle direct storage paths or local assets
    const cleanPath = trimmedSrc.replace(/^\/+/, '').replace(/-20/g, ' ').replace(/%20/g, ' ');
    
    // Check if it's a known local asset first
    if (trimmedSrc.startsWith('/logo.png') || trimmedSrc.startsWith('/favicon')) {
      return trimmedSrc;
    }

    try {
      const storageRef = ref(storage, cleanPath);
      const url = await getDownloadURL(storageRef);
      this.cache.set(src, url);
      return url;
    } catch (e) {
      // If it starts with / and failed storage, it might be a local public file
      if (trimmedSrc.startsWith('/')) {
        return trimmedSrc;
      }
      return '/logo.png';
    }
  }

  /**
   * Clears the cache for a specific source or all sources.
   */
  public clearCache(src?: string): void {
    if (src) {
      const trimmedSrc = src.trim();
      this.cache.delete(trimmedSrc);
    } else {
      this.cache.clear();
    }
  }
}

export const imageService = ImageService.getInstance();
