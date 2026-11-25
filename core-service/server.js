
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

require('dotenv').config();

const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const aiRoutes = require('./routes/aiRoutes');

const Order = require('./models/Order');

const {
  razorpayWebhook
} = require('./controllers/webhookController');

const app = express();

app.use(cors());

// IMPORTANT:
// Webhook must receive the original raw request body.
// Register it before express.json().

app.post(
  '/api/webhooks/razorpay',
  express.raw({
    type: 'application/json',
    limit: '256kb'
  }),
  razorpayWebhook
);

app.use(express.json());

// PUBLIC AND CUSTOMER APIs

app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/ai', aiRoutes);

// PRIVATE ADMINISTRATOR APIs

app.use('/api/admin', adminRoutes);

// DATABASE CONNECTION

const PORT = process.env.PORT || 5001;

async function startServer() {

  try {

    if (process.env.PAYMENT_MODE === 'test') {

      const database = new URL(
        process.env.MONGO_URI
      ).pathname;

      if (database !== '/shopeasy_payment_test') {
        throw new Error(
          'Test payments require the isolated test database'
        );
      }

      if (
        !process.env.RAZORPAY_KEY_ID?.startsWith(
          'rzp_test_'
        )
      ) {
        throw new Error(
          'Razorpay test key required'
        );
      }
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    if (
      process.env.PAYMENT_MODE === 'test' &&
      mongoose.connection.name !== 'shopeasy_payment_test'
    ) {
      throw new Error('Incorrect test database');
    }

    await Order.init();

    console.log('MongoDB connected');

    console.log(
      'Database:',
      mongoose.connection.name
    );

    console.log(
      'Payment mode:',
      process.env.PAYMENT_MODE
    );

    console.log(
      'Webhook configured:',
      Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)
    );

    app.listen(PORT, () => {
      console.log(
        `Core service running on port ${PORT}`
      );
    });

  } catch (err) {

    console.error(
      'Server startup failed:',
      err.message
    );

    process.exit(1);
  }
}

startServer();
