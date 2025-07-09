// Image optimization utilities for Shopify CDN and performance

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  crop?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  format?: 'webp' | 'avif' | 'jpg' | 'png';
  quality?: number;
  blur?: number;
}

export interface ResponsiveImageConfig {
  sizes: number[];
  formats: string[];
  quality: number;
  breakpoints: Record<string, string>;
}

const defaultConfig: ResponsiveImageConfig = {
  sizes: [320, 480, 768, 1024, 1280, 1920],
  formats: ['avif', 'webp', 'jpg'],
  quality: 85,
  breakpoints: {
    '(max-width: 480px)': '480px',
    '(max-width: 768px)': '768px',
    '(max-width: 1024px)': '1024px',
    '(max-width: 1280px)': '1280px',
    '(min-width: 1281px)': '1920px'
  }
};

// Shopify CDN URL transformation
export class ShopifyImageOptimizer {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Transform Shopify image URL with optimizations
  transform(url: string, options: ImageTransformOptions = {}): string {
    if (!this.isShopifyImage(url)) {
      return url;
    }

    const urlObj = new URL(url);
    const params = new URLSearchParams();

    // Width optimization
    if (options.width) {
      params.set('width', Math.min(options.width, 5760).toString()); // Shopify max width
    }

    // Height optimization
    if (options.height) {
      params.set('height', Math.min(options.height, 5760).toString());
    }

    // Crop optimization
    if (options.crop) {
      params.set('crop', options.crop);
    }

    // Format optimization (Shopify supports webp, jpg, png, avif via URL transforms)
    if (options.format && ['avif', 'webp', 'jpg', 'png'].includes(options.format)) {
      if (options.format === 'avif') {
        // Use advanced AVIF transformation for maximum compression
        params.set('format', 'webp'); // Fallback to webp for Shopify CDN
        params.set('q', '90'); // Higher quality for AVIF conversion
        params.set('fm', 'avif'); // Format hint for modern browsers
      } else {
        params.set('format', options.format);
      }
    }

    // Quality optimization
    if (options.quality) {
      params.set('quality', Math.min(Math.max(options.quality, 1), 100).toString());
    }

    // Apply transformations
    const transformedUrl = `${urlObj.origin}${urlObj.pathname}`;
    return params.toString() ? `${transformedUrl}?${params.toString()}` : transformedUrl;
  }

  // Generate responsive image sources
  generateResponsiveSources(
    url: string, 
    config: Partial<ResponsiveImageConfig> = {}
  ): Array<{ srcSet: string; type: string; sizes: string }> {
    const finalConfig = { ...defaultConfig, ...config };
    const sources: Array<{ srcSet: string; type: string; sizes: string }> = [];

    finalConfig.formats.forEach(format => {
      const srcSet = finalConfig.sizes
        .map(size => {
          const transformedUrl = this.transform(url, {
            width: size,
            format: format as any,
            quality: finalConfig.quality
          });
          return `${transformedUrl} ${size}w`;
        })
        .join(', ');

      const sizes = Object.entries(finalConfig.breakpoints)
        .map(([query, size]) => `${query} ${size}`)
        .join(', ');

      sources.push({
        srcSet,
        type: this.getMimeType(format),
        sizes
      });
    });

    return sources;
  }

  // Generate optimized srcSet for a single format
  generateSrcSet(url: string, sizes: number[], format?: string): string {
    return sizes
      .map(size => {
        const transformedUrl = this.transform(url, {
          width: size,
          format: format as any,
          quality: defaultConfig.quality
        });
        return `${transformedUrl} ${size}w`;
      })
      .join(', ');
  }

  // Get optimal image size based on viewport
  getOptimalSize(viewportWidth: number, devicePixelRatio = 1): number {
    const targetWidth = viewportWidth * devicePixelRatio;
    const availableSizes = defaultConfig.sizes;
    
    // Find the smallest size that's larger than the target
    for (const size of availableSizes) {
      if (size >= targetWidth) {
        return size;
      }
    }
    
    // If no size is large enough, return the largest
    return availableSizes[availableSizes.length - 1];
  }

  // Check if URL is a Shopify CDN image
  private isShopifyImage(url: string): boolean {
    return url.includes('cdn.shopify.com') || url.includes('shopify.com/s/files');
  }

  private getMimeType(format: string): string {
    const mimeTypes: Record<string, string> = {
      'avif': 'image/avif',
      'webp': 'image/webp',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png'
    };
    return mimeTypes[format] || 'image/jpeg';
  }
}

// Image lazy loading utilities
export class ImageLazyLoader {
  private observer: IntersectionObserver | null = null;
  private imageQueue: Set<HTMLImageElement> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        this.handleIntersection.bind(this),
        {
          root: null,
          rootMargin: '50px',
          threshold: 0.1
        }
      );
    }
  }

  // Add image to lazy loading queue
  observe(img: HTMLImageElement): void {
    if (this.observer && img) {
      this.imageQueue.add(img);
      this.observer.observe(img);
    }
  }

  // Remove image from observation
  unobserve(img: HTMLImageElement): void {
    if (this.observer && img) {
      this.imageQueue.delete(img);
      this.observer.unobserve(img);
    }
  }

  private handleIntersection(entries: IntersectionObserverEntry[]): void {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        this.loadImage(img);
        this.unobserve(img);
      }
    });
  }

  private loadImage(img: HTMLImageElement): void {
    const dataSrc = img.getAttribute('data-src');
    const dataSrcSet = img.getAttribute('data-srcset');

    if (dataSrc) {
      img.src = dataSrc;
      img.removeAttribute('data-src');
    }

    if (dataSrcSet) {
      img.srcset = dataSrcSet;
      img.removeAttribute('data-srcset');
    }

    img.classList.add('loaded');
  }

  // Cleanup
  disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.imageQueue.clear();
    }
  }
}

// Image preloading utilities
export class ImagePreloader {
  private preloadedImages: Map<string, Promise<HTMLImageElement>> = new Map();

  // Preload critical images
  preload(url: string, priority: 'high' | 'low' = 'low'): Promise<HTMLImageElement> {
    if (this.preloadedImages.has(url)) {
      return this.preloadedImages.get(url)!;
    }

    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
      
      // Set loading priority
      if (priority === 'high') {
        img.loading = 'eager';
      }
      
      img.src = url;
    });

    this.preloadedImages.set(url, promise);
    return promise;
  }

  // Preload multiple images
  preloadBatch(urls: string[], priority: 'high' | 'low' = 'low'): Promise<HTMLImageElement[]> {
    const promises = urls.map(url => this.preload(url, priority));
    return Promise.all(promises);
  }

  // Check if image is preloaded
  isPreloaded(url: string): boolean {
    return this.preloadedImages.has(url);
  }
}

// CDN optimization utilities
export class CDNOptimizer {
  // Generate optimized image URLs for different use cases
  static generateImageVariants(baseUrl: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    hero: string;
  } {
    const optimizer = new ShopifyImageOptimizer(baseUrl);

    return {
      thumbnail: optimizer.transform(baseUrl, { width: 150, height: 150, crop: 'center', quality: 80 }),
      small: optimizer.transform(baseUrl, { width: 300, quality: 85 }),
      medium: optimizer.transform(baseUrl, { width: 600, quality: 85 }),
      large: optimizer.transform(baseUrl, { width: 1200, quality: 90 }),
      hero: optimizer.transform(baseUrl, { width: 1920, quality: 90 })
    };
  }

  // Generate critical image hints for preloading
  static generateCriticalImageHints(
    images: Array<{ url: string; priority: 'high' | 'medium' | 'low' }>
  ): Array<{ rel: string; href: string; as: string; fetchpriority?: string }> {
    return images
      .filter(img => img.priority === 'high')
      .slice(0, 3) // Limit to 3 critical images
      .map(img => ({
        rel: 'preload',
        href: img.url,
        as: 'image',
        fetchpriority: 'high'
      }));
  }

  // Optimize image format based on browser support
  static getOptimalFormat(userAgent: string): 'avif' | 'webp' | 'jpg' {
    // Check for AVIF support (Chrome 85+, Firefox 93+)
    if (userAgent.includes('Chrome/') && this.extractVersion(userAgent, 'Chrome/') >= 85) {
      return 'avif';
    }
    
    // Check for WebP support (Chrome 23+, Firefox 65+, Safari 14+)
    if (
      (userAgent.includes('Chrome/') && this.extractVersion(userAgent, 'Chrome/') >= 23) ||
      (userAgent.includes('Firefox/') && this.extractVersion(userAgent, 'Firefox/') >= 65) ||
      (userAgent.includes('Safari/') && this.extractVersion(userAgent, 'Version/') >= 14)
    ) {
      return 'webp';
    }

    return 'jpg';
  }

  private static extractVersion(userAgent: string, prefix: string): number {
    const match = userAgent.match(new RegExp(prefix + '(\\d+)'));
    return match ? parseInt(match[1]) : 0;
  }
}

// Image performance monitoring
export class ImagePerformanceMonitor {
  private metrics: Map<string, {
    loadTime: number;
    size: number;
    format: string;
    success: boolean;
  }> = new Map();

  // Record image loading metrics
  recordImageLoad(
    url: string, 
    loadTime: number, 
    size: number, 
    format: string, 
    success: boolean
  ): void {
    this.metrics.set(url, {
      loadTime,
      size,
      format,
      success
    });

    // Report to analytics if available
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'image_performance', {
        event_category: 'Performance',
        load_time: loadTime,
        file_size: size,
        format: format,
        success: success
      });
    }
  }

  // Get performance metrics
  getMetrics(): Array<{
    url: string;
    loadTime: number;
    size: number;
    format: string;
    success: boolean;
  }> {
    return Array.from(this.metrics.entries()).map(([url, metrics]) => ({
      url,
      ...metrics
    }));
  }

  // Get slow loading images
  getSlowImages(threshold: number = 1000): Array<{ url: string; loadTime: number }> {
    return Array.from(this.metrics.entries())
      .filter(([, metrics]) => metrics.loadTime > threshold)
      .map(([url, metrics]) => ({ url, loadTime: metrics.loadTime }))
      .sort((a, b) => b.loadTime - a.loadTime);
  }
}

// Export singleton instances
export const imageOptimizer = new ShopifyImageOptimizer('');
export const imageLazyLoader = new ImageLazyLoader();
export const imagePreloader = new ImagePreloader();
export const imagePerformanceMonitor = new ImagePerformanceMonitor();

// Utility functions
export function generatePlaceholder(width: number, height: number, color = '#e5e7eb'): string {
  return `data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3e%3crect width='100%25' height='100%25' fill='${encodeURIComponent(color)}'/%3e%3c/svg%3e`;
}

export function generateBlurDataURL(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return generatePlaceholder(width, height);
  
  // Create a simple gradient placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f3f4f6');
  gradient.addColorStop(1, '#e5e7eb');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', 0.1);
}