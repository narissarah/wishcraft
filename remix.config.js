/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildPath: "build/index.js",
  serverConditions: ["node"],
  serverModuleFormat: "esm",
  serverDependenciesToBundle: [
    "@shopify/shopify-app-remix",
    "@shopify/polaris",
    "@shopify/app-bridge", 
    "@shopify/app-bridge-react",
    "date-fns",
    // Only bundle specific client-side app imports, not server files
    /^~\/components/,
    /^~\/styles/,
    /^~\/lib\/types/,
    /^~\/lib\/utils\.(ts|js)$/,  // Only client utils, not server utils
  ],
  future: {
    // v3 flags for React Router v7 compatibility
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: false, // Disabled to fix auth route discovery issues
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
  // Remove rollupOptions - this should be handled by vite.config.ts
};