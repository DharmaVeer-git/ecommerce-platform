const mongoose = require('mongoose');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// GET CUSTOMER WISHLIST

exports.getWishlist = async (req, res) => {
  try {
    const items = await Wishlist.find({
      userId: req.userId
    })
      .populate(
        'productId',
        'name description image price stock category brand isActive'
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      items
        .filter(item =>
          item.productId &&
          item.productId.isActive !== false
        )
        .map(item => ({
          ...item.productId,
          savedAt: item.createdAt
        }))
    );

  } catch (error) {
    console.error('Wishlist retrieval failed:', error.message);

    return res.status(500).json({
      message: 'Unable to load your wishlist.'
    });
  }
};

// ADD PRODUCT TO WISHLIST

exports.addWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'Invalid product ID.'
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: { $ne: false }
    });

    if (!product) {
      return res.status(404).json({
        message: 'Product unavailable.'
      });
    }

    await Wishlist.updateOne(
      {
        userId: req.userId,
        productId
      },
      {
        $setOnInsert: {
          userId: req.userId,
          productId
        }
      },
      {
        upsert: true
      }
    );

    return res.json({
      message: 'Product saved to wishlist.'
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.json({
        message: 'Product already saved.'
      });
    }

    console.error('Wishlist addition failed:', error.message);

    return res.status(500).json({
      message: 'Unable to save product.'
    });
  }
};

// REMOVE PRODUCT FROM WISHLIST

exports.removeWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'Invalid product ID.'
      });
    }

    await Wishlist.deleteOne({
      userId: req.userId,
      productId
    });

    return res.json({
      message: 'Product removed from wishlist.'
    });

  } catch (error) {
    console.error('Wishlist removal failed:', error.message);

    return res.status(500).json({
      message: 'Unable to remove product.'
    });
  }
};