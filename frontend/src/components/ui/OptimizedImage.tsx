'use client';

import { memo, useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_PLAYER_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' fill='none'><rect width='100' height='100' rx='20' fill='%231a2d52'/><circle cx='50' cy='40' r='18' fill='%23d4a843' fill-opacity='0.8'/><path d='M20 80c0-15 12-25 30-25s30 10 30 25z' fill='%23d4a843' fill-opacity='0.8'/></svg>";

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallback?: string;
  onClick?: () => void;
  title?: string;
  /** Priority loading - skips lazy load */
  priority?: boolean;
}

/**
 * OptimizedImage — A performance-focused image component with:
 * - Lazy loading + async decoding by default
 * - Instant SVG placeholder while loading (no layout shift)
 * - Smooth fade-in transition on load
 * - Error fallback to SVG default
 * - React.memo to prevent unnecessary re-renders
 * - fetchpriority hint for above-fold images
 */
const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  fallback = DEFAULT_PLAYER_PHOTO,
  onClick,
  title,
  priority = false,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when src changes
  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  // Check if image is already cached by browser
  useEffect(() => {
    if (!src || error) return;
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src, error]);

  const handleLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  const displaySrc = error || !src ? fallback : src;

  return (
    <img
      ref={imgRef}
      src={displaySrc}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ objectFit: 'cover' }}
      onClick={onClick}
      title={title}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});

export default OptimizedImage;
export { DEFAULT_PLAYER_PHOTO };
