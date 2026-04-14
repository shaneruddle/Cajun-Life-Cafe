import React, { useState, useEffect, useCallback } from 'react';
import { imageService } from '../../services/imageService';

interface FirebaseImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
}

/**
 * FirebaseImage: A smart image component that uses ImageService to resolve URLs
 * and handles automatic fallbacks for common image extensions.
 */
export const FirebaseImage: React.FC<FirebaseImageProps> = ({ 
  src, 
  fallbackSrc = '/logo.png', 
  alt, 
  className,
  ...props 
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [errorCount, setErrorCount] = useState(0);
  const [alternativePaths, setAlternativePaths] = useState<string[]>([]);
  const [isResolving, setIsResolving] = useState(true);

  const resolveImage = useCallback(async () => {
    if (!src) {
      setResolvedUrl(fallbackSrc);
      setIsResolving(false);
      return;
    }

    setIsResolving(true);
    try {
      const url = await imageService.resolve(src);
      console.log(`FirebaseImage: Resolved ${src} to ${url}`);
      setResolvedUrl(url);
      setAlternativePaths(imageService.getAlternativePaths(url));
    } catch (err) {
      console.error("FirebaseImage: Failed to resolve source:", src, err);
      setResolvedUrl(fallbackSrc);
    } finally {
      setIsResolving(false);
    }
  }, [src, fallbackSrc]);

  useEffect(() => {
    setErrorCount(0);
    setAlternativePaths([]);
    resolveImage();
  }, [resolveImage]);

  const handleError = () => {
    // Don't handle errors while still resolving the initial URL
    if (isResolving) return;

    if (errorCount < alternativePaths.length) {
      const nextPath = alternativePaths[errorCount];
      console.warn(`FirebaseImage: Failed to load ${resolvedUrl}. Trying fallback ${errorCount + 1}/${alternativePaths.length}: ${nextPath}`);
      setResolvedUrl(nextPath);
      setErrorCount(prev => prev + 1);
    } else if (resolvedUrl !== fallbackSrc) {
      console.error(`FirebaseImage: All fallbacks failed for ${src}. Final fallback to ${fallbackSrc}`);
      setResolvedUrl(fallbackSrc);
    }
  };

  // Use a key that changes with the resolvedUrl to force re-render of the img tag
  const imgKey = `${src}-${resolvedUrl}-${errorCount}`;

  return (
    <img
      key={imgKey}
      src={resolvedUrl || (isResolving ? undefined : fallbackSrc)}
      alt={alt}
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
};
