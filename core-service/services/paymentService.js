const mongoose = require('mongoose');

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

async function finalizePayment(order, payment) {

  // ================= TEST MODE PROTECTION =================

  if (
    process.env.PAYMENT_MODE !== 'test' ||
    mongoose.connection.name !== 'shopeasy_payment_test'
  ) {
    throw new Error('Unsafe payment environment');
  }

  // ================= PAYMENT VALIDATION =================

  if (
    order.paymentMode !== 'test' ||
    !payment.id ||
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== order.amountPaise ||
    payment.currency !== 'INR' ||
    payment.status !== 'captured' ||
    Number(payment.amount_refunded || 0) !== 0
  ) {
    throw new Error('Invalid captured payment');
  }

  const session = await mongoose.startSession();

  let completedOrder;

  try {

    await session.withTransaction(async () => {

      const currentOrder = await Order.findOne({
        _id: order._id,
        userId: order.userId,
        paymentMode: 'test'
      }).session(session);

      if (!currentOrder) {
        throw new Error('Order not found');
      }

      // ================= REFUND PROTECTION =================

      if (
        currentOrder.status === 'refunded' ||
        currentOrder.paymentStatus === 'refunded' ||
        Number(currentOrder.refundedAmountPaise || 0) > 0 ||
        ['pending', 'partial', 'refunded'].includes(
          currentOrder.refundStatus
        )
      ) {
        throw new Error(
          'Order has a refund or requires refund reconciliation'
        );
      }

      // ================= PAYMENT ID PROTECTION =================

      if (
        currentOrder.razorpayPaymentId &&
        currentOrder.razorpayPaymentId !== payment.id
      ) {
        throw new Error('Payment mismatch');
      }

      if (
        currentOrder.razorpayOrderId !== payment.order_id ||
        currentOrder.amountPaise !== payment.amount
      ) {
        throw new Error('Order details mismatch');
      }

      if (currentOrder.status === 'cancelled') {
        throw new Error('Order requires reconciliation');
      }

      // ================= DUPLICATE PAYMENT PROTECTION =================

      // Prevent repeated inventory deductions.

      if (currentOrder.inventoryUpdated) {

        if (
          currentOrder.razorpayPaymentId !== payment.id
        ) {
          throw new Error('Payment mismatch');
        }

        if (
          currentOrder.status === 'test_paid' &&
          currentOrder.checkoutActive
        ) {
          currentOrder.checkoutActive = false;

          await currentOrder.save({ session });
        }

        completedOrder = currentOrder;

        return;
      }

      // ================= PAYMENT REVIEW PROTECTION =================

      // Do not automatically fulfill orders requiring review.

      if (currentOrder.status === 'payment_review') {

        completedOrder = currentOrder;

        return;
      }

      // ================= UPDATE PAYMENT DETAILS =================

      currentOrder.paymentStatus = 'captured';

      currentOrder.razorpayPaymentId = payment.id;

      currentOrder.transactionId = payment.id;

      currentOrder.paymentMethod =
        payment.method || 'RAZORPAY';

      currentOrder.paidAt =
        currentOrder.paidAt || new Date();

      // ================= VALIDATE INVENTORY =================

      for (const item of currentOrder.items) {

        if (
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          throw new Error('Invalid order quantity');
        }

        const product = await Product.findOne({
          _id: item.productId,
          isActive: { $ne: false },
          stock: { $gte: item.quantity }
        }).session(session);

        if (!product) {

          currentOrder.status = 'payment_review';

          await currentOrder.save({ session });

          completedOrder = currentOrder;

          return;
        }
      }

      // ================= DEDUCT INVENTORY =================

      // Deduct inventory atomically.

      for (const item of currentOrder.items) {

        const result = await Product.updateOne(
          {
            _id: item.productId,
            isActive: { $ne: false },
            stock: { $gte: item.quantity }
          },
          {
            $inc: {
              stock: -item.quantity
            }
          },
          { session }
        );

        if (result.modifiedCount !== 1) {
          throw new Error('Inventory changed');
        }
      }

      // ================= COMPLETE ORDER =================

      currentOrder.status = 'test_paid';

      currentOrder.inventoryUpdated = true;

      // Release the checkout reservation only after success.

      currentOrder.checkoutActive = false;

      await currentOrder.save({ session });

      // ================= UPDATE CUSTOMER CART =================

      const cart = await Cart.findOne({
        userId: currentOrder.userId
      }).session(session);

      if (cart) {

        for (const purchased of currentOrder.items) {

          const item = cart.items.find(
            i =>
              String(i.productId) ===
              String(purchased.productId)
          );

          if (item) {

            item.quantity = Math.max(
              0,
              item.quantity - purchased.quantity
            );
          }
        }

        cart.items = cart.items.filter(
          item => item.quantity > 0
        );

        await cart.save({ session });
      }

      completedOrder = currentOrder;

    });

    return completedOrder;

  } finally {

    await session.endSession();

  }
}

module.exports = { finalizePayment };