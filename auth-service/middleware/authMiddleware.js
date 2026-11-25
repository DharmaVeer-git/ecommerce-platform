const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

module.exports = function (req, res, next) {

  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Authentication required.'
    });
  }

  const token = authorization.slice(7).trim();

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );

    if (!decoded.id || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({
        message: 'Invalid authentication token.'
      });
    }

    req.userId = String(decoded.id);

    next();

  } catch (error) {

    return res.status(401).json({
      message: 'Session expired or invalid. Please sign in again.'
    });

  }

};