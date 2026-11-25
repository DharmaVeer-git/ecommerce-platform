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

const app = express();

app.use(cors());
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

mongoose.connect(process.env.MONGO_URI)
  .then(() => {

    console.log('MongoDB connected');

    app.listen(PORT, () => {
      console.log(
        `Core service running on port ${PORT}`
      );
    });

  })
  .catch((err) => {

    console.error(
      'MongoDB connection failed:',
      err.message
    );

    process.exit(1);

  });