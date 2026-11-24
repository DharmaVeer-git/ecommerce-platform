
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
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
