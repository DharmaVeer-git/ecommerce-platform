
const express = require('express');
const { rateLimit } = require('express-rate-limit');

const router = express.Router();

const authMiddleware = require(
  '../middleware/authMiddleware'
);

const {
  signup,
  login,
  requestOTP,
  verifyOTP,
  getProfile,
  updateProfile,
  updateAddress
} = require('../controllers/authController');

// ================= OTP RATE LIMITING =================

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    message:
      'Too many requests. Please try again later.'
  }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    message:
      'Too many verification attempts.'
  }
});

// ================= AUTHENTICATION ROUTES =================

router.post(
  '/signup',
  otpLimiter,
  signup
);

router.post(
  '/login',
  otpLimiter,
  login
);

router.post(
  '/request-otp',
  otpLimiter,
  requestOTP
);

router.post(
  '/verify-otp',
  verifyLimiter,
  verifyOTP
);

// ================= CUSTOMER PROFILE ROUTES =================

router.get(
  '/profile',
  authMiddleware,
  getProfile
);

router.put(
  '/profile',
  authMiddleware,
  updateProfile
);

// ================= DELIVERY ADDRESS ROUTES =================

router.put(
  '/profile/address',
  authMiddleware,
  updateAddress
);

module.exports = router;
