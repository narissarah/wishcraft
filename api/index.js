module.exports = function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    success: true,
    message: "WishCraft API Fixed!",
    timestamp: new Date().toISOString()
  });
};