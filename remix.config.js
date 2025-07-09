/** @type {import('@remix-run/dev').AppConfig} */
export default {
  ignoredRouteFiles: ["**/.*"],
  appDirectory: "app",
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  serverBuildPath: "build/index.js",
  serverConditions: ["node"],
  serverModuleFormat: "esm",
  serverDependenciesToBundle: [/.+/],
  serverNodeBuiltinsPolyfill: {
    modules: {
      stream: true,
      buffer: true,
      util: true,
      process: true,
      path: true,
      url: true,
      fs: "empty",
    },
    globals: {
      Buffer: true,
      process: true,
    },
  },
  future: {
    // v3 flags for React Router v7 compatibility
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};