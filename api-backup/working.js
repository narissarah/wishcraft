module.exports = function(req, res) {
  res.json({ success: true, message: "Working!", time: Date.now() });
};