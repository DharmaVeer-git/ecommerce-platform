const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');

const { chat } = require('../controllers/aiController');

const router = express.Router();

// Allow guests, but verify authenticated customers
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return next();
  }

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Invalid authorization'
    });
  }

  try {
    const token = header.split(' ')[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ['HS256'] }
    );

    if (!mongoose.isValidObjectId(decoded.id)) {
      throw new Error('Invalid customer ID');
    }

    req.userId = String(decoded.id);

    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Session expired. Please sign in again.'
    });
  }
}

// Protect AI API quota
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    message: 'Too many messages. Please wait one minute.'
  }
});

router.post(
  '/chat',
  aiLimiter,
  optionalAuth,
  chat
);

module.exports = router;