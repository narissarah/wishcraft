module.exports = (req, res) => { res.status(200).json({ success: true, message: "Simple working", timestamp: new Date().toISOString() }); };
