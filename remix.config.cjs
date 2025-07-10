/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildPath: "build/index.js",
  serverConditions: ["node"],
  serverModuleFormat: "cjs",
  serverDependenciesToBundle: [
    "@shopify/shopify-app-remix",
    "@shopify/polaris",
    "@shopify/app-bridge",
    "@shopify/app-bridge-react",
    "isomorphic-dompurify",
    "date-fns",
    "web-vitals",
  ],
  future: {
    // v3 flags for React Router v7 compatibility
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
  // Performance optimizations for 2025
  browserNodeBuiltinsPolyfill: {
    modules: {
      crypto: true,
      buffer: true,
      stream: true,
    },
  },
  // Dev server configuration
  dev: {
    port: process.env.DEV_PORT ? parseInt(process.env.DEV_PORT) : 3000,
  },
  // Bundle optimization
  rollupOptions: {
    output: {
      manualChunks: {
        // Separate vendor chunks for better caching
        vendor: ['react', 'react-dom'],
        polaris: ['@shopify/polaris'],
        shopify: ['@shopify/shopify-app-remix', '@shopify/app-bridge', '@shopify/app-bridge-react'],
        utils: ['date-fns', 'isomorphic-dompurify']
      }
    }
  }
};