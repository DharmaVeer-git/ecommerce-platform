const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  password: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    default: '',
    trim: true
  },

  address: {
    fullName: { type: String, default: '' },
    phone: { type: String, default: '' },
    street: { type: String, default: '' },
    landmark: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    country: { type: String, default: 'India' }
  },

  termsAccepted: {
    type: Boolean,
    default: false
  },

  termsAcceptedAt: {
    type: Date,
    default: null
  },

  termsVersion: {
    type: String,
    default: ''
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  otpHash: {
    type: String,
    select: false
  },

  otpExpires: {
    type: Date
  },

  otpAttempts: {
    type: Number,
    default: 0
  },

  otpLastSent: {
    type: Date
  },

  otpPurpose: {
    type: String,
    enum: ['signup', 'login']
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);