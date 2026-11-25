
const crypto = require('crypto');
const mongoose = require('mongoose');

const Order = require('../models/Order');
const getRazorpay = require('../config/razorpay');

const {
  finalizePayment
} = require('../services/paymentService');

const {
  processRefund
} = require('../services/refundService');

exports.razorpayWebhook = async (req, res) => {
  try {

    // ================= TEST MODE PROTECTION =================

    if (
      process.env.PAYMENT_MODE !== 'test' ||
      mongoose.connection.name !== 'shopeasy_payment_test'
    ) {
      return res.status(503).json({
        message: 'Webhook unavailable'
      });
    }

    // ================= SIGNATURE VERIFICATION =================

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    const signature = req.headers['x-razorpay-signature'];

    if (!secret) {
      return res.status(503).json({
        message: 'Webhook not configured'
      });
    }

    if (
      !Buffer.isBuffer(req.body) ||
      typeof signature !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(signature)
    ) {
      return res.status(400).json({
        message: 'Invalid webhook request'
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.body)
      .digest('hex');

    const validSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );

    if (!validSignature) {
      return res.status(400).json({
        message: 'Invalid webhook signature'
      });
    }

    // ================= PARSE WEBHOOK =================

    let event;

    try {
      event = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({
        message: 'Invalid webhook JSON'
      });
    }

    if (!event || typeof event.event !== 'string') {
      return res.status(400).json({
        message: 'Invalid webhook event'
      });
    }

    console.log('Razorpay event received:', event.event);

    // ================= REFUND EVENTS =================

    if (
      [
        'refund.created',
        'refund.processed',
        'refund.failed'
      ].includes(event.event)
    ) {

      const refund = event.payload?.refund?.entity;

      if (
        typeof refund?.id !== 'string' ||
        !refund.id.startsWith('rfnd_')
      ) {
        return res.status(400).json({
          message: 'Invalid refund event'
        });
      }

      // Independently fetch and synchronize the refund.
      await processRefund(refund.id);

      console.log(
        'Razorpay refund synchronized:',
        refund.id,
        event.event
      );

      return res.status(200).json({
        received: true,
        event: event.event,
        refundId: refund.id,
        synchronized: true
      });
    }

    // ================= FAILED PAYMENT =================

    if (event.event === 'payment.failed') {

      console.log(
        'Razorpay payment failed:',
        event.payload?.payment?.entity?.id
      );

      return res.status(200).json({
        received: true,
        event: event.event
      });
    }

    // ================= IGNORE UNSUPPORTED EVENTS =================

    if (event.event !== 'payment.captured') {
      return res.status(200).json({
        received: true,
        ignored: true
      });
    }

    // ================= CAPTURED PAYMENT =================

    const entity = event.payload?.payment?.entity;

    if (
      typeof entity?.id !== 'string' ||
      typeof entity?.order_id !== 'string'
    ) {
      return res.status(400).json({
        message: 'Invalid payment event'
      });
    }

    const order = await Order.findOne({
      razorpayOrderId: entity.order_id,
      paymentMode: 'test'
    });

    if (!order) {

      console.warn(
        'Webhook order not found:',
        entity.order_id
      );

      return res.status(503).json({
        message: 'Order requires reconciliation'
      });
    }

    // ================= VERIFY WITH RAZORPAY =================

    const razorpay = getRazorpay();

    const payment = await razorpay.payments.fetch(
      entity.id
    );

    if (
      payment.id !== entity.id ||
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== order.amountPaise ||
      payment.currency !== 'INR'
    ) {
      return res.status(409).json({
        message: 'Payment details do not match order'
      });
    }

    // ================= REFUND PROTECTION =================

    if (
      payment.status === 'refunded' ||
      Number(payment.amount_refunded || 0) > 0 ||
      order.paymentStatus === 'refunded' ||
      Number(order.refundedAmountPaise || 0) > 0 ||
      ['pending', 'partial', 'refunded'].includes(
        order.refundStatus
      )
    ) {

      // Do not finalize a refunded payment again.
      // Return a retryable response until reconciled.

      return res.status(503).json({
        received: true,
        message: 'Refund reconciliation required'
      });
    }

    if (payment.status !== 'captured') {
      return res.status(503).json({
        message: 'Payment capture not confirmed'
      });
    }

    // ================= FINALIZE PAYMENT =================

    const completedOrder = await finalizePayment(
      order,
      payment
    );

    console.log(
      'Razorpay webhook processed:',
      completedOrder._id,
      completedOrder.status
    );

    return res.status(200).json({
      received: true,
      event: event.event,
      status: completedOrder.status
    });

  } catch (err) {

    console.error(
      'Razorpay webhook error:',
      err.name,
      err.message
    );

    return res.status(500).json({
      message: 'Webhook processing failed'
    });
  }
};
