/**
 * Image Optimization Pipeline for WishCraft
 * Implements modern image formats and responsive loading
 */

/**
 * Shopify CDN image transformation parameters
 */
export interface ImageTransformOptions {
  width?: number;
  height?: number;
  crop?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  scale?: 2 | 3;
  format?: 'jpg' | 'pjpg' | 'webp' | 'png';
}

/**
 * Generate Shopify CDN URL with transformations
 */
export function getShopifyImageUrl(
  originalUrl: string,
  options: ImageTransformOptions = {}
): string {
  if (!originalUrl || !originalUrl.includes('cdn.shopify.com')) {
    return originalUrl;
  }

  const url = new URL(originalUrl);
  const params = new URLSearchParams();

  // Add transformation parameters
  if (options.width) {
    params.set('width', options.width.toString());
  }
  if (options.height) {
    params.set('height', options.height.toString());
  }
  if (options.crop) {
    params.set('crop', options.crop);
  }
  if (options.scale) {
    params.set('scale', options.scale.toString());
  }
  if (options.format) {
    // Replace file extension
    const pathParts = url.pathname.split('.');
    pathParts[pathParts.length - 1] = options.format;
    url.pathname = pathParts.join('.');
  }

  // Apply parameters
  url.search = params.toString();
  return url.toString();
}

/**
 * Generate responsive image srcset
 */
export function generateSrcSet(
  originalUrl: string,
  widths: number[] = [320, 640, 960, 1280, 1920],
  format?: 'webp' | 'jpg'
): string {
  return widths
    .map(width => {
      const url = getShopifyImageUrl(originalUrl, { width, format });
      return `${url} ${width}w`;
    })
    .join(', ');
}

/**
 * Get optimal image format based on browser support
 */
export function getOptimalFormat(): 'webp' | 'jpg' {
  if (typeof window === 'undefined') return 'jpg';
  
  // Check WebP support
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const isWebPSupported = canvas.toDataURL('image/webp').indexOf('image/webp') === 0;
  
  return isWebPSupported ? 'webp' : 'jpg';
}

/**
 * Responsive image component props
 */
export interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Generate picture element for optimal format delivery
 */
export function generatePictureElement(props: ResponsiveImageProps): string {
  const { src, alt, sizes = '100vw', loading = 'lazy', className } = props;
  
  // Generate sources for different formats
  const webpSrcSet = generateSrcSet(src, undefined, 'webp');
  const jpgSrcSet = generateSrcSet(src, undefined, 'jpg');
  
  return `
    <picture>
      <source
        type="image/webp"
        srcset="${webpSrcSet}"
        sizes="${sizes}"
      />
      <source
        type="image/jpeg"
        srcset="${jpgSrcSet}"
        sizes="${sizes}"
      />
      <img
        src="${getShopifyImageUrl(src, { width: 800, format: 'jpg' })}"
        alt="${alt}"
        loading="${loading}"
        ${className ? `class="${className}"` : ''}
        ${props.width ? `width="${props.width}"` : ''}
        ${props.height ? `height="${props.height}"` : ''}
      />
    </picture>
  `;
}

/**
 * Preload critical images
 */
export function preloadImage(
  src: string,
  options: { as?: 'image'; type?: string; media?: string } = {}
): void {
  if (typeof window === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = options.as || 'image';
  link.href = src;
  
  if (options.type) {
    link.type = options.type;
  }
  if (options.media) {
    link.media = options.media;
  }
  
  document.head.appendChild(link);
}

/**
 * Lazy load images with Intersection Observer
 */
export class ImageLazyLoader {
  private observer: IntersectionObserver;
  private loadedImages = new Set<string>();
  
  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: '50px',
        threshold: 0.01,
        ...options,
      }
    );
  }
  
  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.loadImage(img);
        this.observer.unobserve(img);
      }
    });
  }
  
  private loadImage(img: HTMLImageElement) {
    // Handle data-src attribute
    if (img.dataset.src) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
    
    // Handle data-srcset attribute
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
      delete img.dataset.srcset;
    }
    
    // Handle picture element sources
    const picture = img.closest('picture');
    if (picture) {
      const sources = picture.querySelectorAll('source');
      sources.forEach(source => {
        if (source.dataset.srcset) {
          source.srcset = source.dataset.srcset;
          delete source.dataset.srcset;
        }
      });
    }
    
    // Mark as loaded
    img.classList.add('loaded');
    this.loadedImages.add(img.src);
  }
  
  observe(img: HTMLImageElement) {
    if (!this.loadedImages.has(img.src)) {
      this.observer.observe(img);
    }
  }
  
  disconnect() {
    this.observer.disconnect();
  }
}

/**
 * Image optimization utilities
 */
export const ImageUtils = {
  /**
   * Get thumbnail URL
   */
  getThumbnail(url: string, size: number = 150): string {
    return getShopifyImageUrl(url, {
      width: size,
      height: size,
      crop: 'center',
    });
  },
  
  /**
   * Get product image URL
   */
  getProductImage(url: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const sizes = {
      small: 300,
      medium: 600,
      large: 1200,
    };
    
    return getShopifyImageUrl(url, {
      width: sizes[size],
      format: getOptimalFormat(),
    });
  },
  
  /**
   * Get hero image URL
   */
  getHeroImage(url: string, width: number = 1920): string {
    return getShopifyImageUrl(url, {
      width,
      format: getOptimalFormat(),
    });
  },
  
  /**
   * Generate blur placeholder
   */
  generateBlurPlaceholder(width: number = 20, height: number = 20): string {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' fill='%23f6f6f7' filter='url(%23b)'/%3E%3C/svg%3E`;
  },
};

/**
 * Performance hints for images
 */
export function addImagePerformanceHints(images: Array<{ url: string; priority: boolean }>) {
  if (typeof window === 'undefined') return;
  
  images.forEach(({ url, priority }) => {
    if (priority) {
      // Preload critical images
      preloadImage(getShopifyImageUrl(url, { 
        width: 1200, 
        format: 'webp' 
      }), {
        type: 'image/webp',
      });
    } else {
      // Prefetch non-critical images
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = getShopifyImageUrl(url, { 
        width: 600, 
        format: 'webp' 
      });
      document.head.appendChild(link);
    }
  });
}

/**
 * CSS for smooth image loading
 */
export const imageLoadingStyles = `
  img {
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }
  
  img.loaded {
    opacity: 1;
  }
  
  picture {
    display: block;
    position: relative;
    overflow: hidden;
  }
  
  picture::before {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }
  
  picture.loading::before {
    opacity: 1;
  }
`;