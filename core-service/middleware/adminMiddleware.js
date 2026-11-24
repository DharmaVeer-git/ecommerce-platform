module.exports = function (req, res, next) {
  const adminUserId = process.env.ADMIN_USER_ID?.trim();

  if (!adminUserId) {
    return res.status(503).json({
      message: 'Admin access is not configured'
    });
  }

  if (!req.userId) {
    return res.status(401).json({
      message: 'Authentication required'
    });
  }

  if (String(req.userId) !== adminUserId) {
    return res.status(403).json({
      message: 'Access denied. Administrator only.'
    });
  }

  next();
};