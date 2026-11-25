const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({

  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },

  userId: {
    type: String,
    required: true
  },

  razorpayRefundId: {
    type: String,
    required: true,
    unique: true
  },

  razorpayPaymentId: {
    type: String,
    required: true,
    index: true
  },

  razorpayOrderId: {
    type: String,
    required: true
  },

  amountPaise: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isSafeInteger,
      message: 'Invalid refund amount'
    }
  },

  currency: {
    type: String,
    enum: ['INR'],
    default: 'INR'
  },

  status: {
    type: String,
    enum: [
      'pending',
      'processed',
      'failed'
    ],
    required: true
  },

  paymentMode: {
    type: String,
    enum: ['test', 'live'],
    required: true
  },

  processedAt: {
    type: Date,
    default: null
  },

  failedAt: {
    type: Date,
    default: null
  },

  gatewayCreatedAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

refundSchema.index({
  orderId: 1,
  status: 1
});

module.exports = mongoose.model(
  'Refund',
  refundSchema
);