module.exports = function handler(req, res) {
  try {
    console.log('Hello endpoint called:', req.method, req.url);
    
    res.status(200).json({ 
      success: true,
      message: "Hello from WishCraft!",
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      version: "1.0.0"
    });
  } catch (error) {
    console.error('Hello endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}