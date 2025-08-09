module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  res.status(200).json({
    success: true,
    message: "✅ NEW CODE IS DEPLOYED AND WORKING!",
    timestamp: new Date().toISOString(),
    deploymentStatus: "FIXED - CommonJS modules working",
    method: req.method,
    url: req.url,
    headers: {
      userAgent: req.headers['user-agent'],
      host: req.headers.host
    },
    cacheHeaders: "no-cache applied",
    version: "2.0.0-verified"
  });
};