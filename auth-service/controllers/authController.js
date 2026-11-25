
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sendOTP = require('../utils/sendOTP');

// ================= CONFIGURATION =================

const OTP_EXPIRY = 5 * 60 * 1000;
const RESEND_DELAY = 60 * 1000;
const TERMS_VERSION = '1.0';

const PROFILE_FIELDS =
  'name email phone address isVerified termsAccepted termsAcceptedAt termsVersion createdAt';

// ================= HELPER FUNCTIONS =================

function hashOTP(otp, identifier) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${identifier}:${otp}`)
    .digest('hex');
}

function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

function createToken(user) {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

function normalizeEmail(email) {
  return typeof email === 'string'
    ? email.trim().toLowerCase()
    : '';
}

function normalizePhone(phone) {
  return typeof phone === 'string'
    ? phone.trim()
    : '';
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function handleError(res, error) {
  if (error.code === 11000) {
    return res.status(409).json({
      message: 'Account or registration already exists.'
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Invalid account details.'
    });
  }

  return res.status(error.status || 500).json({
    message: error.status
      ? error.message
      : 'Something went wrong. Please try again.'
  });
}

// ================= CREATE PENDING REGISTRATION =================

exports.signup = async (req, res) => {
  try {
    const {
      name,
      password,
      phone,
      termsAccepted
    } = req.body;

    const email = normalizeEmail(req.body.email);
    const mobile = normalizePhone(phone);

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 100 ||
      !validEmail(email) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({
        message:
          'Enter valid registration details and a password of at least 8 characters.'
      });
    }

    if (!validPhone(mobile)) {
      return res.status(400).json({
        message: 'Enter a valid 10-digit mobile number.'
      });
    }

    if (termsAccepted !== true) {
      return res.status(400).json({
        message:
          'Please accept the Terms and Conditions and Privacy Policy.'
      });
    }

    if (await User.findOne({ email })) {
      return res.status(409).json({
        message: 'Account already exists. Please login.'
      });
    }

    const otp = generateOTP();

    const challengeId = crypto
      .randomBytes(32)
      .toString('hex');

    const passwordHash = await bcrypt.hash(password, 12);

    const now = new Date();

    const pending = await PendingUser.findOneAndUpdate(
      {
        email,
        $or: [
          {
            otpLastSent: {
              $lte: new Date(Date.now() - RESEND_DELAY)
            }
          },
          {
            expiresAt: { $lte: now }
          }
        ]
      },
      {
        $set: {
          name: name.trim(),
          email,
          password: passwordHash,

          phone: mobile,

          termsAccepted: true,
          termsAcceptedAt: now,
          termsVersion: TERMS_VERSION,

          challengeId,
          otpHash: hashOTP(otp, challengeId),

          otpExpires: new Date(
            Date.now() + OTP_EXPIRY
          ),

          otpAttempts: 0,
          otpLastSent: now,

          expiresAt: new Date(
            Date.now() + 30 * 60 * 1000
          )
        }
      },
      {
        upsert: true,
        new: true,
        runValidators: true
      }
    );

    try {
      await sendOTP(email, otp);

    } catch {
      await PendingUser.deleteOne({
        _id: pending._id,
        challengeId
      });

      return res.status(503).json({
        message: 'Unable to send email. Please try again.'
      });
    }

    return res.status(201).json({
      message: 'Verification code sent.',
      requiresOTP: true,
      email,
      challengeId
    });

  } catch (error) {
    return handleError(res, error);
  }
};

// ================= ISSUE LOGIN OTP =================

async function issueLoginOTP(user) {
  const otp = generateOTP();

  const otpHash = hashOTP(otp, user._id);

  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,

      $or: [
        {
          otpLastSent: { $exists: false }
        },
        {
          otpLastSent: null
        },
        {
          otpLastSent: {
            $lte: new Date(Date.now() - RESEND_DELAY)
          }
        }
      ]
    },
    {
      $set: {
        otpHash,

        otpExpires: new Date(
          Date.now() + OTP_EXPIRY
        ),

        otpAttempts: 0,
        otpLastSent: new Date(),
        otpPurpose: 'login'
      }
    }
  );

  if (!updated) {
    const error = new Error('Please wait 60 seconds.');
    error.status = 429;
    throw error;
  }

  try {
    await sendOTP(user.email, otp);

  } catch {
    await User.updateOne(
      {
        _id: user._id,
        otpHash
      },
      {
        $unset: {
          otpHash: 1,
          otpExpires: 1,
          otpPurpose: 1
        }
      }
    );

    const error = new Error('Unable to send OTP.');
    error.status = 503;

    throw error;
  }
}

// ================= PASSWORD LOGIN =================

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    const { password } = req.body;

    if (
      !validEmail(email) ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Invalid credentials.'
      });
    }

    const user = await User.findOne({
      email,
      isVerified: { $ne: false }
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(400).json({
        message: 'Invalid credentials.'
      });
    }

    await issueLoginOTP(user);

    return res.json({
      message: 'OTP sent to your email.',
      requiresOTP: true,
      email
    });

  } catch (error) {
    return handleError(res, error);
  }
};

// ================= REQUEST OR RESEND OTP =================

exports.requestOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    const { challengeId } = req.body;

    if (!validEmail(email)) {
      return res.status(400).json({
        message: 'Enter a valid email.'
      });
    }

    // Resend registration OTP

    if (
      typeof challengeId === 'string' &&
      challengeId
    ) {
      const otp = generateOTP();

      const otpHash = hashOTP(otp, challengeId);

      const pending = await PendingUser.findOneAndUpdate(
        {
          email,
          challengeId,

          expiresAt: {
            $gt: new Date()
          },

          otpLastSent: {
            $lte: new Date(Date.now() - RESEND_DELAY)
          }
        },
        {
          $set: {
            otpHash,

            otpExpires: new Date(
              Date.now() + OTP_EXPIRY
            ),

            otpAttempts: 0,
            otpLastSent: new Date()
          }
        }
      );

      if (!pending) {
        return res.status(400).json({
          message:
            'Wait 60 seconds or restart registration.'
        });
      }

      try {
        await sendOTP(email, otp);

      } catch {
        return res.status(503).json({
          message: 'Unable to send OTP. Try again later.'
        });
      }

      return res.json({
        message: 'New verification code sent.',
        requiresOTP: true
      });
    }

    // Passwordless login

    const user = await User.findOne({
      email,
      isVerified: { $ne: false }
    });

    if (user) {
      try {
        await issueLoginOTP(user);

      } catch (error) {
        if (
          error.status !== 429 &&
          error.status !== 503
        ) {
          throw error;
        }
      }
    }

    return res.json({
      message:
        'If your account exists, an OTP will be sent.',

      requiresOTP: true
    });

  } catch (error) {
    return handleError(res, error);
  }
};

// ================= VERIFY REGISTRATION OTP =================

async function verifyRegistration(
  email,
  otp,
  challengeId,
  res
) {
  const filter = {
    email,
    challengeId,

    otpExpires: {
      $gt: new Date()
    },

    expiresAt: {
      $gt: new Date()
    },

    otpAttempts: {
      $lt: 5
    }
  };

  const pending = await PendingUser
    .findOne(filter)
    .select('+otpHash');

  if (!pending) {
    return res.status(400).json({
      message:
        'Invalid or expired registration. Request a new OTP.'
    });
  }

  const submittedHash = hashOTP(
    otp,
    challengeId
  );

  if (submittedHash !== pending.otpHash) {
    await PendingUser.updateOne(
      {
        ...filter,
        otpHash: pending.otpHash
      },
      {
        $inc: {
          otpAttempts: 1
        }
      }
    );

    return res.status(400).json({
      message: 'Incorrect OTP.'
    });
  }

  // Ensure registration contains the required profile details

  if (
    !validPhone(normalizePhone(pending.phone)) ||
    pending.termsAccepted !== true
  ) {
    return res.status(400).json({
      message:
        'Registration details are incomplete. Please restart registration.'
    });
  }

  const verified = await PendingUser.findOneAndDelete({
    ...filter,
    otpHash: submittedHash
  });

  if (!verified) {
    return res.status(400).json({
      message: 'OTP expired or already used.'
    });
  }

  // Create permanent customer account
  // Profile details are automatically saved here.

  const user = await User.create({
    name: verified.name,

    email: verified.email,

    password: verified.password,

    phone: verified.phone,

    termsAccepted: verified.termsAccepted,

    termsAcceptedAt: verified.termsAcceptedAt,

    termsVersion: verified.termsVersion,

    isVerified: true
  });

  return res.json({
    message: 'Account verified successfully.',

    token: createToken(user),

    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    }
  });
}

// ================= VERIFY LOGIN OR REGISTRATION OTP =================

exports.verifyOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    const {
      otp,
      challengeId
    } = req.body;

    if (
      !validEmail(email) ||
      typeof otp !== 'string' ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        message: 'Enter a valid six-digit OTP.'
      });
    }

    // Registration OTP

    if (
      typeof challengeId === 'string' &&
      challengeId
    ) {
      return await verifyRegistration(
        email,
        otp,
        challengeId,
        res
      );
    }

    // Login OTP

    const user = await User.findOne({
      email,
      isVerified: { $ne: false }
    }).select('+otpHash');

    if (
      !user ||
      !user.otpHash ||
      !user.otpExpires ||
      user.otpExpires <= new Date() ||
      user.otpAttempts >= 5 ||
      user.otpPurpose !== 'login'
    ) {
      return res.status(400).json({
        message: 'Invalid or expired OTP.'
      });
    }

    const submittedHash = hashOTP(
      otp,
      user._id
    );

    const filter = {
      _id: user._id,

      otpHash: user.otpHash,

      otpPurpose: 'login',

      otpExpires: {
        $gt: new Date()
      },

      otpAttempts: {
        $lt: 5
      }
    };

    if (submittedHash !== user.otpHash) {
      await User.updateOne(
        filter,
        {
          $inc: {
            otpAttempts: 1
          }
        }
      );

      return res.status(400).json({
        message: 'Incorrect OTP.'
      });
    }

    const verifiedUser = await User.findOneAndUpdate(
      filter,
      {
        $set: {
          isVerified: true,
          otpAttempts: 0
        },

        $unset: {
          otpHash: 1,
          otpExpires: 1,
          otpPurpose: 1
        }
      },
      {
        new: true
      }
    );

    if (!verifiedUser) {
      return res.status(400).json({
        message: 'OTP expired or already used.'
      });
    }

    return res.json({
      message: 'Login successful.',

      token: createToken(verifiedUser),

      user: {
        id: verifiedUser._id,
        name: verifiedUser.name,
        email: verifiedUser.email,
        phone: verifiedUser.phone || '',
        isVerified: verifiedUser.isVerified,
        createdAt: verifiedUser.createdAt
      }
    });

  } catch (error) {
    return handleError(res, error);
  }
};

// ================= GET CUSTOMER PROFILE =================

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.userId,
      isVerified: { $ne: false }
    }).select(PROFILE_FIELDS);

    if (!user) {
      return res.status(404).json({
        message: 'Customer account not found.'
      });
    }

    return res.status(200).json(user);

  } catch (error) {
    return handleError(res, error);
  }
};

// ================= UPDATE CUSTOMER PROFILE =================

exports.updateProfile = async (req, res) => {
  try {
    const {
      name,
      phone
    } = req.body;

    const mobile = normalizePhone(phone);

    if (
      typeof name !== 'string' ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        message: 'Enter a valid full name.'
      });
    }

    if (!validPhone(mobile)) {
      return res.status(400).json({
        message: 'Enter a valid 10-digit mobile number.'
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: req.userId,
        isVerified: { $ne: false }
      },
      {
        $set: {
          name: name.trim(),
          phone: mobile
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).select(PROFILE_FIELDS);

    if (!user) {
      return res.status(404).json({
        message: 'Customer account not found.'
      });
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user
    });

  } catch (error) {
    return handleError(res, error);
  }
};

// ================= UPDATE DELIVERY ADDRESS =================

exports.updateAddress = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      street,
      landmark = '',
      city,
      state,
      pincode
    } = req.body;

    const mobile = normalizePhone(phone);

    const requiredFields = [
      fullName,
      street,
      city,
      state,
      pincode
    ];

    if (
      requiredFields.some(
        value =>
          typeof value !== 'string' ||
          !value.trim() ||
          value.trim().length > 250
      )
    ) {
      return res.status(400).json({
        message:
          'Please enter all required delivery address details.'
      });
    }

    if (!validPhone(mobile)) {
      return res.status(400).json({
        message: 'Enter a valid delivery mobile number.'
      });
    }

    if (!/^[1-9]\d{5}$/.test(pincode.trim())) {
      return res.status(400).json({
        message: 'Enter a valid six-digit PIN code.'
      });
    }

    if (
      typeof landmark !== 'string' ||
      landmark.trim().length > 250
    ) {
      return res.status(400).json({
        message: 'Invalid landmark.'
      });
    }

    const address = {
      fullName: fullName.trim(),
      phone: mobile,
      street: street.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: 'India'
    };

    const user = await User.findOneAndUpdate(
      {
        _id: req.userId,
        isVerified: { $ne: false }
      },
      {
        $set: {
          address
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).select(PROFILE_FIELDS);

    if (!user) {
      return res.status(404).json({
        message: 'Customer account not found.'
      });
    }

    return res.status(200).json({
      message: 'Delivery address saved successfully.',
      user
    });

  } catch (error) {
    return handleError(res, error);
  }
};
