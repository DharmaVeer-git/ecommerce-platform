const mongoose = require('mongoose');

const Order = require('../models/Order');
const Refund = require('../models/Refund');
const getRazorpay = require('../config/razorpay');

async function processRefund(refundId) {

  // ================= TEST MODE PROTECTION =================

  if (
    process.env.PAYMENT_MODE !== 'test' ||
    mongoose.connection.name !== 'shopeasy_payment_test'
  ) {
    throw new Error('Refund processing unavailable');
  }

  if (
    typeof refundId !== 'string' ||
    !refundId.startsWith('rfnd_')
  ) {
    throw new Error('Invalid refund ID');
  }

  const razorpay = getRazorpay();

  await Refund.init();

  // ================= FETCH VERIFIED REFUND =================

  const refund = await razorpay.refunds.fetch(refundId);

  if (
    refund.id !== refundId ||
    !refund.payment_id ||
    !Number.isSafeInteger(refund.amount) ||
    refund.amount <= 0 ||
    refund.currency !== 'INR' ||
    !['pending', 'processed', 'failed'].includes(refund.status)
  ) {
    throw new Error('Invalid Razorpay refund details');
  }

  const payment = await razorpay.payments.fetch(
    refund.payment_id
  );

  // ================= FIND ORIGINAL ORDER =================

  const order = await Order.findOne({
    razorpayOrderId: payment.order_id,
    paymentMode: 'test'
  });

  if (!order) {
    throw new Error('Refund order not found');
  }

  if (
    payment.id !== refund.payment_id ||
    payment.order_id !== order.razorpayOrderId ||
    payment.amount !== order.amountPaise ||
    payment.currency !== 'INR' ||
    refund.amount > payment.amount ||
    (
      order.razorpayPaymentId &&
      order.razorpayPaymentId !== payment.id
    )
  ) {
    throw new Error('Refund payment details mismatch');
  }

  // ================= DATABASE TRANSACTION =================

  const session = await mongoose.startSession();

  let updatedOrder;

  try {

    await session.withTransaction(async () => {

      const currentOrder = await Order.findOne({
        _id: order._id,
        paymentMode: 'test'
      }).session(session);

      if (!currentOrder) {
        throw new Error('Order unavailable');
      }

      if (
        currentOrder.razorpayPaymentId &&
        currentOrder.razorpayPaymentId !== payment.id
      ) {
        throw new Error('Order payment mismatch');
      }

      // Serialize refund updates against the same order.

      await Order.updateOne(
        { _id: currentOrder._id },
        { $inc: { __v: 1 } },
        { session }
      );

      let record = await Refund.findOne({
        razorpayRefundId: refund.id
      }).session(session);

      if (!record) {

        record = new Refund({
          orderId: currentOrder._id,
          userId: currentOrder.userId,
          razorpayRefundId: refund.id,
          razorpayPaymentId: payment.id,
          razorpayOrderId: payment.order_id,
          amountPaise: refund.amount,
          currency: 'INR',
          status: refund.status,
          paymentMode: 'test',

          gatewayCreatedAt: refund.created_at
            ? new Date(refund.created_at * 1000)
            : null
        });

      } else {

        if (
          String(record.orderId) !==
            String(currentOrder._id) ||
          record.razorpayPaymentId !== payment.id ||
          record.amountPaise !== refund.amount
        ) {
          throw new Error('Refund record mismatch');
        }

        // Never downgrade an already processed refund.

        if (
          record.status !== 'processed' &&
          !(
            record.status === 'failed' &&
            refund.status === 'pending'
          )
        ) {
          record.status = refund.status;
        }
      }

      if (
        record.status === 'processed' &&
        !record.processedAt
      ) {
        record.processedAt = new Date();
      }

      if (
        record.status === 'failed' &&
        !record.failedAt
      ) {
        record.failedAt = new Date();
      }

      await record.save({ session });

      // ================= CALCULATE TOTAL REFUNDS =================

      const refunds = await Refund.find({
        orderId: currentOrder._id,
        paymentMode: 'test'
      }).session(session);

      const processedAmount = refunds
        .filter((r) => r.status === 'processed')
        .reduce(
          (sum, r) => sum + r.amountPaise,
          0
        );

      const hasPending = refunds.some(
        (r) => r.status === 'pending'
      );

      const hasFailed = refunds.some(
        (r) => r.status === 'failed'
      );

      if (
        !Number.isSafeInteger(processedAmount) ||
        processedAmount > currentOrder.amountPaise
      ) {
        throw new Error('Refund total exceeds payment amount');
      }

      currentOrder.refundedAmountPaise =
        processedAmount;

      // ================= FULL REFUND =================

      if (
        processedAmount === currentOrder.amountPaise
      ) {

        currentOrder.refundStatus = 'refunded';

        currentOrder.paymentStatus = 'refunded';

        currentOrder.status = 'refunded';

        currentOrder.checkoutActive = false;

      // ================= PARTIAL REFUND =================

      } else if (processedAmount > 0) {

        currentOrder.refundStatus = 'partial';

        // Prevent payment retries on refunded orders.

        if (!currentOrder.inventoryUpdated) {
          currentOrder.status = 'payment_review';
        }

      // ================= PENDING REFUND =================

      } else if (hasPending) {

        currentOrder.refundStatus = 'pending';

      // ================= FAILED REFUND =================

      } else if (hasFailed) {

        currentOrder.refundStatus = 'failed';

      } else {

        currentOrder.refundStatus = 'none';

      }

      if (record.status === 'processed') {

        const previousTime =
          currentOrder.lastRefundAt?.getTime() || 0;

        const refundTime =
          record.processedAt.getTime();

        currentOrder.lastRefundAt = new Date(
          Math.max(previousTime, refundTime)
        );
      }

      await currentOrder.save({ session });

      updatedOrder = currentOrder;

    });

    console.log(
      'Razorpay refund processed:',
      updatedOrder._id,
      updatedOrder.refundStatus
    );

    return updatedOrder;

  } finally {

    await session.endSession();

  }
}

module.exports = {
  processRefund
};