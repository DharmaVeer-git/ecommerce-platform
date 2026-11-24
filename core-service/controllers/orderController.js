const mongoose = require('mongoose');
const crypto = require('crypto');

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.placeOrder = async (req, res) => {
  let session;

  try {
    session = await mongoose.startSession();

    const userId = req.userId;
    const expectedAmount = req.body?.expectedAmount;

    if (
      typeof expectedAmount !== 'number' ||
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0
    ) {
      return res.status(400).json({
        message: 'Invalid checkout amount'
      });
    }

    const transactionId = 'DEMO-' + crypto.randomUUID();

    // Simulated payment only. No real money is transferred.
    const paymentSuccess = Math.random() < 0.9;

    let completedOrder;

    await session.withTransaction(async () => {
      const cart = await Cart.findOne({
        userId
      }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }

      const orderItems = [];
      let totalPaise = 0;

      for (const item of cart.items) {
        if (
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1
        ) {
          throw new Error('Invalid product quantity');
        }

        const product = await Product.findOne({
          _id: item.productId,
          isActive: { $ne: false }
        }).session(session);

        if (!product) {
          throw new Error(
            `${item.name} is no longer available`
          );
        }

        if (product.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}`
          );
        }

        if (
          !Number.isFinite(product.price) ||
          product.price < 0
        ) {
          throw new Error('Invalid product price');
        }

        orderItems.push({
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity: item.quantity
        });

        totalPaise +=
          Math.round(product.price * 100) *
          item.quantity;
      }

      if (
        totalPaise !== Math.round(expectedAmount * 100)
      ) {
        throw new Error(
          'Product prices have changed. Please review your cart.'
        );
      }

      if (!paymentSuccess) {
        throw new Error(
          'Demo payment failed. Please try again.'
        );
      }

      for (const item of orderItems) {
        const result = await Product.updateOne(
          {
            _id: item.productId,
            isActive: { $ne: false },
            stock: { $gte: item.quantity }
          },
          {
            $inc: { stock: -item.quantity }
          },
          { session }
        );

        if (result.modifiedCount !== 1) {
          throw new Error(
            `Stock changed for ${item.name}`
          );
        }
      }

      const orders = await Order.create(
        [
          {
            userId,
            items: orderItems,
            totalAmount: totalPaise / 100,
            status: 'demo_paid',
            paymentMethod: 'DEMO_UPI',
            transactionId
          }
        ],
        { session }
      );

      cart.items = [];
      await cart.save({ session });

      completedOrder = orders[0];
    });

    return res.status(201).json({
      message: 'Demo order completed successfully',
      demo: true,
      transactionId,
      amount: completedOrder.totalAmount,
      order: completedOrder
    });

  } catch (err) {
    console.error('Order error:', err.message);

    const expectedErrors = [
      'Cart is empty',
      'Invalid product quantity',
      'Invalid product price',
      'no longer available',
      'Insufficient stock',
      'Product prices have changed',
      'Demo payment failed',
      'Stock changed'
    ];

    const isExpected = expectedErrors.some(
      message => err.message.includes(message)
    );

    return res.status(isExpected ? 400 : 500).json({
      message: isExpected
        ? err.message
        : 'Unable to complete demo order'
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    res.status(200).json(orders);

  } catch (err) {
    console.error('Get orders error:', err.message);

    res.status(500).json({
      message: 'Server error'
    });
  }
};