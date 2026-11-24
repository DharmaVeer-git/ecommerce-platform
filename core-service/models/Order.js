const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({

  userId: {
    type: String,
    required: true
  },

  items: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number
    }
  ],

  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },

  status: {
    type: String,
    default: 'pending'
  },

  paymentMethod: {
    type: String,
    default: ''
  },

  transactionId: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);