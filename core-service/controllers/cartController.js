const Cart = require('../models/Cart');
const Product = require('../models/Product');
const mongoose = require('mongoose');

exports.addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const quantity = req.body.quantity ?? 1;
    const userId = req.userId;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        message: 'Invalid product ID'
      });
    }

    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        message: 'Quantity must be a positive integer'
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: { $ne: false }
    });

    if (!product) {
      return res.status(404).json({
        message: 'Product is unavailable'
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: []
      });
    }

    const existingItem = cart.items.find(
      item => item.productId.toString() === productId
    );

    const totalQuantity =
      (existingItem ? existingItem.quantity : 0) + quantity;

    if (totalQuantity > product.stock) {
      return res.status(400).json({
        message: `Only ${product.stock} items available`
      });
    }

    if (existingItem) {
      existingItem.quantity = totalQuantity;
      existingItem.name = product.name;
      existingItem.price = product.price;
      existingItem.image = product.image;
    } else {
      cart.items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity
      });
    }

    await cart.save();

    res.status(200).json(cart);

  } catch (err) {
    console.error('Cart error:', err.message);

    res.status(500).json({
      message: 'Server error'
    });
  }
};

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      userId: req.userId
    });

    res.status(200).json(cart || { items: [] });

  } catch (err) {
    console.error('Get cart error:', err.message);

    res.status(500).json({
      message: 'Server error'
    });
  }
};