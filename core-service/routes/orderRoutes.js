
const express = require('express');

const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');

const {
  placeOrder,
  getOrders
} = require('../controllers/orderController');

const {
  createPaymentOrder,
  verifyPayment
} = require('../controllers/razorpayController');

const {
  getPaymentStatus,
  getActiveCheckout
} = require('../controllers/paymentStatusController');

// ================= RAZORPAY PAYMENT =================

router.post(
  '/create-payment',
  authMiddleware,
  createPaymentOrder
);

router.post(
  '/verify-payment',
  authMiddleware,
  verifyPayment
);

// ================= ACTIVE CHECKOUT RECOVERY =================

router.get(
  '/active-checkout',
  authMiddleware,
  getActiveCheckout
);

// ================= PAYMENT STATUS =================

router.get(
  '/payment-status/:orderId',
  authMiddleware,
  getPaymentStatus
);

// ================= DEMO ORDER =================

router.post('/', authMiddleware, (req, res) => {

  if (
    ['test', 'live'].includes(
      process.env.PAYMENT_MODE
    )
  ) {
    return res.status(403).json({
      message: 'Please use Razorpay checkout'
    });
  }

  return placeOrder(req, res);
});

// ================= ORDER HISTORY =================

router.get(
  '/',
  authMiddleware,
  getOrders
);

module.exports = router;
