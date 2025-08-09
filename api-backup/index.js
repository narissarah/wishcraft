module.exports = (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      message: "WishCraft API is working",
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}