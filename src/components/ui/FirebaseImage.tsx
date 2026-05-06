import React, { useState, useEffect, useCallback, useRef } from 'react';
import { imageService } from '../../services/imageService';

interface FirebaseImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  useSkeleton?: boolean;
  priority?: boolean;
}

/**
 * FirebaseImage: A component that resolves URLs using ImageService.
 * It strictly uses the provided path (ideally primaryPhotoPath) from Firebase Storage.
 * Implements lazy loading via Intersection Observer and provides a loading skeleton.
 */
export const FirebaseImage: React.FC<FirebaseImageProps> = ({ 
  src, 
  fallbackSrc = '/logo.png', 
  alt, 
  className,
  useSkeleton = true,
  priority = false,
  ...props 
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: '800px' }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [src, priority]);

  const resolveImage = useCallback(async () => {
    if (!src) {
      setResolvedUrl(fallbackSrc);
      return;
    }

    setIsResolving(true);
    
    try {
      const url = await imageService.resolve(src);
      setResolvedUrl(url);
    } catch (err) {
      setResolvedUrl(fallbackSrc);
    } finally {
      setIsResolving(false);
    }
  }, [src, fallbackSrc]);

  useEffect(() => {
    if (isInView) {
      resolveImage();
    }
  }, [isInView, resolveImage]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleError = () => {
    if (resolvedUrl !== fallbackSrc) {
      setResolvedUrl(fallbackSrc);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden ${className || ''}`}
      style={{ minHeight: props.height ? `${props.height}px` : '100%' }}
    >
      {/* Skeleton / Placeholder State */}
      {useSkeleton && (!resolvedUrl || !imageLoaded) && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}

      {resolvedUrl && (
        <img
          src={resolvedUrl}
          alt={alt}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleImageLoad}
          onError={handleError}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};
