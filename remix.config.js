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
  ],
  future: {
    // v3 flags for React Router v7 compatibility
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};