
const express = require('express');
const { rateLimit } = require('express-rate-limit');

const router = express.Router();

const {
  signup,
  login,
  requestOTP,
  verifyOTP
} = require('../controllers/authController');

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests. Please try again later.'
  }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many verification attempts.'
  }
});

router.post('/signup', otpLimiter, signup);
router.post('/login', otpLimiter, login);
router.post('/request-otp', otpLimiter, requestOTP);
router.post('/verify-otp', verifyLimiter, verifyOTP);

module.exports = router;
