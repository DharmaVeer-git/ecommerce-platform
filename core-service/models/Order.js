const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true
  },

  items: [{
    productId: mongoose.Schema.Types.ObjectId,
    name: String,
    price: Number,
    quantity: Number
  }],

  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  amountPaise: {
    type: Number,
    min: 0
  },

  currency: {
    type: String,
    default: 'INR'
  },

  status: {
    type: String,
    default: 'pending'
  },

  paymentMethod: {
    type: String,
    default: ''
  },

  paymentStatus: {
    type: String,
    enum: [
      'pending',
      'authorized',
      'captured',
      'failed',
      'refunded'
    ]
  },

  paymentMode: {
    type: String,
    enum: ['test', 'live', 'demo']
  },

  transactionId: {
    type: String,
    default: ''
  },

  razorpayOrderId: String,

  razorpayPaymentId: String,

  paidAt: Date,

  refundedAmountPaise: {
  type: Number,
  default: 0,
  min: 0,
  validate: Number.isSafeInteger
},

refundStatus: {
  type: String,
  enum: [
    'none',
    'pending',
    'partial',
    'refunded',
    'failed'
  ],
  default: 'none'
},

lastRefundAt: {
  type: Date,
  default: null
},

  inventoryUpdated: {
    type: Boolean,
    default: false
  },

  checkoutActive: {
    type: Boolean,
    default: false
  },

  checkoutFingerprint: String,

  gatewayCreationStatus: {
    type: String,
    enum: ['creating', 'ready', 'unknown']
  }

}, {
  timestamps: true
});

orderSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, sparse: true }
);

orderSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, sparse: true }
);

orderSchema.index(
  { userId: 1, paymentMode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      checkoutActive: true
    },
    name: 'unique_active_checkout'
  }
);

module.exports = mongoose.model('Order', orderSchema);