
const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
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

    otpHash: {
      type: String,
      required: true,
      select: false
    },

    challengeId: {
      type: String,
      required: true
    },

    otpExpires: {
      type: Date,
      required: true
    },

    otpAttempts: {
      type: Number,
      default: 0
    },

    otpLastSent: {
      type: Date,
      default: Date.now
    },

    expiresAt: {
      type: Date,
      required: true,
      expires: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'PendingUser',
  pendingUserSchema
);
