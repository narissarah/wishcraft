import { useEffect, useRef, useState } from 'react';
import { getShopifyImageUrl, generateSrcSet, ImageLazyLoader, ImageUtils, type ResponsiveImageProps } from '~/lib/image-optimization';

/**
 * Optimized Image Component
 * Implements responsive images with lazy loading and format optimization
 */
export function OptimizedImage({
  src,
  alt,
  sizes = '100vw',
  loading = 'lazy',
  priority = false,
  className = '',
  width,
  height,
  placeholder = 'blur',
  onLoad,
  onError,
}: ResponsiveImageProps & {
  placeholder?: 'blur' | 'empty' | 'none';
  onLoad?: () => void;
  onError?: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  
  // Create lazy loader instance
  useEffect(() => {
    if (loading === 'lazy' && !priority && imgRef.current) {
      const lazyLoader = new ImageLazyLoader();
      lazyLoader.observe(imgRef.current);
      
      return () => {
        lazyLoader.disconnect();
      };
    }
  }, [loading, priority]);
  
  // Preload priority images
  useEffect(() => {
    if (priority && src) {
      const img = new Image();
      img.src = getShopifyImageUrl(src, { width: 1200, format: 'webp' });
      img.onload = () => setIsLoaded(true);
      img.onerror = () => setIsError(true);
    }
  }, [priority, src]);
  
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };
  
  const handleError = () => {
    setIsError(true);
    onError?.();
  };
  
  // Generate placeholder
  const placeholderSrc = placeholder === 'blur' 
    ? ImageUtils.generateBlurPlaceholder(width || 100, height || 100)
    : placeholder === 'empty' 
    ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    : undefined;
  
  // Generate responsive sources
  const webpSrcSet = generateSrcSet(src, undefined, 'webp');
  const jpgSrcSet = generateSrcSet(src, undefined, 'jpg');
  const defaultSrc = getShopifyImageUrl(src, { width: 800, format: 'jpg' });
  
  return (
    <picture className={`optimized-image ${isLoaded ? 'loaded' : 'loading'} ${className}`}>
      {/* WebP source */}
      <source
        type="image/webp"
        srcSet={loading === 'lazy' && !priority ? undefined : webpSrcSet}
        data-srcset={loading === 'lazy' && !priority ? webpSrcSet : undefined}
        sizes={sizes}
      />
      
      {/* JPEG fallback */}
      <source
        type="image/jpeg"
        srcSet={loading === 'lazy' && !priority ? undefined : jpgSrcSet}
        data-srcset={loading === 'lazy' && !priority ? jpgSrcSet : undefined}
        sizes={sizes}
      />
      
      {/* Image element */}
      <img
        ref={imgRef}
        src={loading === 'lazy' && !priority ? placeholderSrc : defaultSrc}
        data-src={loading === 'lazy' && !priority ? defaultSrc : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : loading}
        decoding={priority ? 'sync' : 'async'}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
      />
      
      {/* Loading overlay */}
      {!isLoaded && !isError && placeholder !== 'none' && (
        <div
          className="image-loading-overlay"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      )}
      
      {/* Error state */}
      {isError && (
        <div
          className="image-error"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#666',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <p style={{ fontSize: '12px', marginTop: '8px' }}>Image not found</p>
        </div>
      )}
    </picture>
  );
}

/**
 * Product Image Component
 * Optimized for e-commerce product displays
 */
export function ProductImage({
  src,
  alt,
  size = 'medium',
  ...props
}: Omit<ResponsiveImageProps, 'sizes'> & {
  size?: 'thumbnail' | 'small' | 'medium' | 'large';
}) {
  const sizeConfig = {
    thumbnail: { width: 150, height: 150, sizes: '150px' },
    small: { width: 300, height: 300, sizes: '(max-width: 768px) 100vw, 300px' },
    medium: { width: 600, height: 600, sizes: '(max-width: 768px) 100vw, 600px' },
    large: { width: 1200, height: 1200, sizes: '(max-width: 768px) 100vw, 1200px' },
  };
  
  const config = sizeConfig[size];
  const optimizedSrc = ImageUtils.getProductImage(src, size === 'thumbnail' ? 'small' : size);
  
  return (
    <OptimizedImage
      src={optimizedSrc}
      alt={alt}
      width={config.width}
      height={config.height}
      sizes={config.sizes}
      {...props}
    />
  );
}

/**
 * Hero Image Component
 * Optimized for large banner images
 */
export function HeroImage({
  src,
  alt,
  height = 600,
  ...props
}: ResponsiveImageProps & { height?: number }) {
  return (
    <OptimizedImage
      src={ImageUtils.getHeroImage(src)}
      alt={alt}
      sizes="100vw"
      priority
      height={height}
      {...props}
    />
  );
}

/**
 * Gallery Image Component
 * Optimized for image galleries with thumbnails
 */
export function GalleryImage({
  src,
  alt,
  thumbnailSrc,
  onClick,
  ...props
}: ResponsiveImageProps & {
  thumbnailSrc?: string;
  onClick?: () => void;
}) {
  const [showFull, setShowFull] = useState(false);
  
  return (
    <>
      <button
        onClick={() => {
          setShowFull(true);
          onClick?.();
        }}
        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
      >
        <OptimizedImage
          src={thumbnailSrc || ImageUtils.getThumbnail(src)}
          alt={alt}
          sizes="(max-width: 768px) 50vw, 33vw"
          {...props}
        />
      </button>
      
      {showFull && (
        <div
          className="gallery-overlay"
          onClick={() => setShowFull(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <OptimizedImage
            src={src}
            alt={alt}
            sizes="(max-width: 768px) 100vw, 80vw"
            priority
          />
        </div>
      )}
    </>
  );
}

/**
 * CSS for shimmer loading effect
 */
export const imageStyles = `
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  .optimized-image {
    position: relative;
    display: block;
    overflow: hidden;
  }
  
  .optimized-image img {
    display: block;
    width: 100%;
    height: auto;
  }
  
  .image-loading-overlay {
    pointer-events: none;
  }
  
  .gallery-overlay {
    cursor: pointer;
  }
  
  .gallery-overlay img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
  }
`;