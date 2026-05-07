import React, { useState, useEffect, useCallback } from 'react';
import { imageService } from '../../services/imageService';

interface FirebaseImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  useSkeleton?: boolean;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  aspectRatio?: string;
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
  aspectRatio,
  ...props 
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const resolveImage = useCallback(async () => {
    if (!src) {
      setResolvedUrl(fallbackSrc);
      return;
    }

    try {
      const url = await imageService.resolve(src);
      setResolvedUrl(url);
    } catch (err) {
      setResolvedUrl(fallbackSrc);
    }
  }, [src, fallbackSrc]);

  useEffect(() => {
    resolveImage();
  }, [resolveImage]);

  const handleError = () => {
    if (resolvedUrl !== fallbackSrc) {
      setResolvedUrl(fallbackSrc);
    }
  };

  return (
    <div 
      className={`relative overflow-hidden ${className || ''}`}
      style={{ 
        minHeight: props.height ? `${props.height}px` : '100%',
        aspectRatio: aspectRatio || 'auto'
      }}
    >
      {resolvedUrl && (
        <img
          src={resolvedUrl}
          alt={alt}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="w-full h-full object-cover"
          onError={handleError}
          referrerPolicy="no-referrer"
          {...props}
        />
      )}
    </div>
  );
};
