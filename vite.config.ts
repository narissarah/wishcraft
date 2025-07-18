import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    // Bundle analyzer for development
    ...(process.env.ANALYZE ? [visualizer({
      filename: './stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap'
    })] : [])
  ],
  
  build: {
    // Optimize bundle size
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react/jsx-runtime'],
          'vendor-remix': ['@remix-run/react', '@remix-run/node'],
          'vendor-shopify': ['@shopify/polaris', '@shopify/app-bridge-react'],
          'vendor-utils': ['date-fns', 'zod', 'bcrypt'],
          
          // App chunks
          'app-lib': ['./app/lib/cache-manager.server', './app/lib/validation-unified.server'],
          'app-components': ['./app/components'],
        },
        
        // Optimize chunk names
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/${facadeModuleId}-[hash].js`;
        },
        
        // Optimize asset names
        assetFileNames: (assetInfo) => {
          if (!assetInfo.name) return `assets/[name]-[hash][extname]`;
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff|woff2|ttf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    
    // Performance budgets
    chunkSizeWarningLimit: 500, // 500kb warning
    
    // Source maps for production debugging
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,
    
    // Asset inlining
    assetsInlineLimit: 4096, // 4kb
    
    // CSS code splitting
    cssCodeSplit: true,
    
    // Report compressed size
    reportCompressedSize: true,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@remix-run/react',
      '@shopify/polaris',
      '@shopify/app-bridge-react',
    ],
    exclude: ['@shopify/shopify-app-remix'],
  },
  
  // Server configuration
  server: {
    warmup: {
      clientFiles: [
        './app/root.tsx',
        './app/routes/**/*.tsx',
        './app/components/**/*.tsx',
      ],
    },
  },
  
  // CSS optimization
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@shopify/polaris/build/esm/styles/foundation/_spacing.scss";`,
      },
    },
  },
  
  // Performance optimizations
  esbuild: {
    legalComments: 'none',
    treeShaking: true,
  },
  
  // Production optimizations
  resolve: {
    alias: {
      "~": resolve(__dirname, "./app"),
      ...(process.env.NODE_ENV === 'production' ? {
        // Use production builds of libraries
        'react': 'react/cjs/react.production.min.js',
        'react-dom': 'react-dom/cjs/react-dom.production.min.js',
      } : {}),
    },
  },
});