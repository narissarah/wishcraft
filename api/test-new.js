module.exports = function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({
    success: true,
    message: "🎉 NEW DEPLOYMENT IS LIVE!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasDatabase: !!process.env.DATABASE_URL,
    hasShopifyKeys: !!process.env.SHOPIFY_API_KEY,
    nodeVersion: process.version,
    platform: process.env.VERCEL ? 'Vercel' : 'Local'
  });
};