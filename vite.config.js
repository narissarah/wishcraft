import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

installGlobals();

export default defineConfig({
  plugins: [
    remix(),
    // Bundle analyzer for development
    process.env.ANALYZE && visualizer({
      filename: "bundle-analysis.html",
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  
  server: {
    port: 3000,
    https: {
      cert: './certs/localhost.pem',
      key: './certs/localhost-key.pem',
    },
  },

  build: {
    // Enable modern build optimizations
    target: "es2020",
    
    // Optimize bundle splitting
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-shopify': ['@shopify/polaris', '@shopify/app-bridge', '@shopify/app-bridge-react'],
          'vendor-utils': ['lru-cache'],
        },
        
        // Optimize chunk file names for caching
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name?.startsWith('vendor-')) {
            return 'assets/[name].[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        
        // Optimize asset file names
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.');
          const ext = info?.[info.length - 1];
          
          if (/\.(css)$/.test(assetInfo.name ?? '')) {
            return 'assets/css/[name]-[hash].[ext]';
          }
          
          if (/\.(png|jpe?g|svg|gif|webp|avif)$/.test(assetInfo.name ?? '')) {
            return 'assets/images/[name]-[hash].[ext]';
          }
          
          if (/\.(woff|woff2|eot|ttf|otf)$/.test(assetInfo.name ?? '')) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          
          return 'assets/[name]-[hash].[ext]';
        },
      },
      
      // External dependencies that should not be bundled
      external: (id) => {
        // Don't bundle Node.js built-ins
        return id.startsWith('node:') || 
               ['fs', 'path', 'crypto', 'stream', 'util'].includes(id);
      },
    },
    
    // Optimize CSS
    cssCodeSplit: true,
    cssMinify: true,
    
    // Enable source maps for production debugging
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Optimize minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
        pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.info'] : [],
      },
      mangle: {
        safari10: true,
      },
      format: {
        safari10: true,
      },
    },
    
    // Optimize module preloading
    modulePreload: {
      polyfill: true,
    },
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@shopify/polaris',
      '@shopify/app-bridge',
      '@shopify/app-bridge-react',
    ],
    exclude: [
      // Node.js built-ins
      'fs',
      'path',
      'crypto',
      'stream',
      'util',
    ],
  },

  // Define global constants for tree shaking
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __PROD__: JSON.stringify(process.env.NODE_ENV === 'production'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },

  // CSS optimization
  css: {
    modules: {
      // Generate shorter class names in production
      generateScopedName: process.env.NODE_ENV === 'production' 
        ? '[hash:base64:5]' 
        : '[name]__[local]__[hash:base64:5]',
    },
    preprocessorOptions: {
      scss: {
        // Add global SCSS variables
        additionalData: `@import "~/styles/variables.scss";`,
      },
    },
  },

  // Enable experimental features for better performance
  experimental: {
    renderBuiltUrl(filename) {
      // Optimize asset URLs for CDN
      if (process.env.CDN_URL) {
        return `${process.env.CDN_URL}/${filename}`;
      }
      return `/${filename}`;
    },
  },
});