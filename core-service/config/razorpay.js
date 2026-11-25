const Razorpay = require('razorpay');
const mongoose = require('mongoose');

function getRazorpay() {

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const mode = process.env.PAYMENT_MODE;

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are missing');
  }

  if (mode !== 'test' || !keyId.startsWith('rzp_test_')) {
    throw new Error('Only Razorpay Test Mode is permitted');
  }

  if (mongoose.connection.name !== 'shopeasy_payment_test') {
    throw new Error('Payment testing requires the test database');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });

}

module.exports = getRazorpay;