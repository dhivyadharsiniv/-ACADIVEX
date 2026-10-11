const db = require('../config/database');

exports.getDashboardStats = (req, res) => {
  try {
    const analytics = db.getAnalytics(req.user);
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
