import { useEffect, useRef, useState } from 'react';
import { imageOptimizer, imageLazyLoader, imagePerformanceMonitor, generatePlaceholder } from '~/lib/image-optimization.server';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width = 800,
  height = 600,
  className = '',
  priority = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  placeholder = 'blur',
  blurDataURL,
  quality = 85,
  onLoad,
  onError
}: OptimizedImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const [loadStartTime, setLoadStartTime] = useState<number | null>(null);

  // Generate responsive sources
  const responsiveSources = imageOptimizer.generateResponsiveSources(src, {
    quality,
    sizes: [320, 480, 768, 1024, 1280, 1920].filter(size => size <= width * 2)
  });

  // Generate fallback srcSet
  const fallbackSrcSet = imageOptimizer.generateSrcSet(
    src,
    [320, 480, 768, 1024, 1280, 1920].filter(size => size <= width * 2),
    'jpg'
  );

  // Generate optimized src
  const optimizedSrc = imageOptimizer.transform(src, {
    width,
    height,
    quality,
    format: 'jpg'
  });

  // Placeholder URL
  const placeholderSrc = blurDataURL || generatePlaceholder(width, height);

  // Lazy loading setup
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [priority]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    
    if (loadStartTime) {
      const loadTime = Date.now() - loadStartTime;
      imagePerformanceMonitor.recordImageLoad(
        src,
        loadTime,
        0, // Size would need to be calculated
        'unknown', // Format detection would need implementation
        true
      );
    }

    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setHasError(true);
    
    if (loadStartTime) {
      const loadTime = Date.now() - loadStartTime;
      imagePerformanceMonitor.recordImageLoad(
        src,
        loadTime,
        0,
        'unknown',
        false
      );
    }

    onError?.();
  };

  // Track load start time when image becomes visible
  useEffect(() => {
    if (isVisible && !loadStartTime) {
      setLoadStartTime(Date.now());
    }
  }, [isVisible, loadStartTime]);

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {/* Placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <img
          src={placeholderSrc}
          alt=""
          className="absolute inset-0 w-full h-full object-cover filter blur-sm scale-110"
          aria-hidden="true"
        />
      )}

      {/* Loading state */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-gray-400 text-center">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Image not available</span>
          </div>
        </div>
      )}

      {/* Main image with responsive sources */}
      {isVisible && !hasError && (
        <picture>
          {responsiveSources.map((source, index) => (
            <source
              key={index}
              srcSet={source.srcSet}
              type={source.type}
              sizes={source.sizes}
            />
          ))}
          <img
            ref={imgRef}
            src={optimizedSrc}
            srcSet={fallbackSrcSet}
            sizes={sizes}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleLoad}
            onError={handleError}
          />
        </picture>
      )}
    </div>
  );
}

// Product image component optimized for registry items
interface ProductImageProps {
  product: {
    images: Array<{
      url: string;
      altText?: string;
      width?: number;
      height?: number;
    }>;
    title: string;
  };
  size?: 'thumbnail' | 'small' | 'medium' | 'large';
  priority?: boolean;
  className?: string;
}

export function ProductImage({ 
  product, 
  size = 'medium', 
  priority = false, 
  className = '' 
}: ProductImageProps) {
  const sizeConfig = {
    thumbnail: { width: 150, height: 150 },
    small: { width: 300, height: 300 },
    medium: { width: 600, height: 600 },
    large: { width: 1200, height: 1200 }
  };

  const { width, height } = sizeConfig[size];
  const image = product.images[0];

  if (!image) {
    return (
      <div 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
        style={{ aspectRatio: '1' }}
      >
        <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  return (
    <OptimizedImage
      src={image.url}
      alt={image.altText || product.title}
      width={width}
      height={height}
      priority={priority}
      className={className}
      sizes={
        size === 'thumbnail' ? '150px' :
        size === 'small' ? '300px' :
        size === 'medium' ? '(max-width: 768px) 100vw, 600px' :
        '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1200px'
      }
    />
  );
}

// Gallery component with optimized image loading
interface ImageGalleryProps {
  images: Array<{
    url: string;
    altText?: string;
    width?: number;
    height?: number;
  }>;
  className?: string;
}

export function ImageGallery({ images, className = '' }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set([0]));

  // Preload adjacent images
  useEffect(() => {
    const preloadIndexes = [
      Math.max(0, currentIndex - 1),
      currentIndex,
      Math.min(images.length - 1, currentIndex + 1)
    ];

    preloadIndexes.forEach(index => {
      if (!preloadedImages.has(index)) {
        const img = new Image();
        img.src = imageOptimizer.transform(images[index].url, {
          width: 800,
          quality: 90
        });
        
        img.onload = () => {
          setPreloadedImages(prev => new Set([...prev, index]));
        };
      }
    });
  }, [currentIndex, images, preloadedImages]);

  return (
    <div className={`relative ${className}`}>
      {/* Main image */}
      <div className="aspect-square relative overflow-hidden rounded-lg">
        <OptimizedImage
          src={images[currentIndex].url}
          alt={images[currentIndex].altText || `Image ${currentIndex + 1}`}
          width={800}
          height={800}
          priority={currentIndex === 0}
          className="w-full h-full"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex mt-4 space-x-2 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 ${
                index === currentIndex ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <OptimizedImage
                src={image.url}
                alt={image.altText || `Thumbnail ${index + 1}`}
                width={64}
                height={64}
                className="w-full h-full"
              />
            </button>
          ))}
        </div>
      )}

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full disabled:opacity-50"
            aria-label="Previous image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <button
            onClick={() => setCurrentIndex(prev => Math.min(images.length - 1, prev + 1))}
            disabled={currentIndex === images.length - 1}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full disabled:opacity-50"
            aria-label="Next image"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}