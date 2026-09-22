const express = require('express');
const router = express.Router();
const { processPayment } = require('../controllers/paymentController');
const auth = require('../middleware/authMiddleware');

router.post('/pay', auth, processPayment);

module.exports = router;