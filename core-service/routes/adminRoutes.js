
const express = require('express');

const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const uploadMiddleware = require('../middleware/uploadMiddleware');

const {
  createProduct,
  getAdminProducts,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

// Protect every admin endpoint
router.use(authMiddleware);
router.use(adminMiddleware);

// Verify administrator access
router.get('/verify', (req, res) => {
  res.status(200).json({
    isAdmin: true,
    message: 'Administrator access granted'
  });
});

// Get all products
router.get('/products', getAdminProducts);

// Add new product
router.post(
  '/products',
  uploadMiddleware,
  createProduct
);

// Update product
router.put(
  '/products/:id',
  uploadMiddleware,
  updateProduct
);

// Remove product from storefront
router.delete(
  '/products/:id',
  deleteProduct
);

// Handle upload errors
router.use((err, req, res, next) => {
  res.status(400).json({
    message: err.code === 'LIMIT_FILE_SIZE'
      ? 'Maximum file size is 10 MB'
      : 'Invalid upload. Check file type and size.'
  });
});

module.exports = router;
