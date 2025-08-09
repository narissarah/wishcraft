module.exports = function handler(req, res) { res.status(200).json({ success: true, message: "Test API working", timestamp: new Date().toISOString() }); };
