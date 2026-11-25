
const mongoose = require('mongoose');

const Order = require('../models/Order');
const getRazorpay = require('../config/razorpay');

const {
  finalizePayment
} = require('../services/paymentService');

const {
  reconcileGatewayOrder
} = require('./razorpayController');

// ================= TEST MODE PROTECTION =================

function isSafePaymentEnvironment() {
  return (
    process.env.PAYMENT_MODE === 'test' &&
    mongoose.connection.name === 'shopeasy_payment_test'
  );
}

// ================= REFUND STATUS HELPER =================

function getRefundResponse(order) {

  const refundedAmountPaise =
    order.refundedAmountPaise || 0;

  if (
    order.status === 'refunded' ||
    order.paymentStatus === 'refunded' ||
    order.refundStatus === 'refunded'
  ) {
    return {
      status: 'refunded',

      message:
        'This order has been fully refunded.',

      canRetry: false,

      refundStatus: 'refunded',

      refundedAmountPaise
    };
  }

  if (
    order.refundStatus === 'partial' ||
    Number(refundedAmountPaise) > 0
  ) {
    return {
      status: 'partially_refunded',

      message:
        'This order has received a partial refund.',

      canRetry: false,

      refundStatus: 'partial',

      refundedAmountPaise
    };
  }

  if (order.refundStatus === 'pending') {
    return {
      status: 'refund_pending',

      message:
        'A refund is currently being processed.',

      canRetry: false,

      refundStatus: 'pending',

      refundedAmountPaise
    };
  }

  return null;
}

// ================= PAYMENT STATUS =================

exports.getPaymentStatus = async (req, res) => {

  try {

    // ================= ENVIRONMENT VALIDATION =================

    if (!isSafePaymentEnvironment()) {
      return res.status(503).json({
        message: 'Payment status unavailable'
      });
    }

    res.set('Cache-Control', 'no-store');

    const orderId = req.params.orderId;

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        message: 'Invalid order ID'
      });
    }

    // ================= FIND CUSTOMER ORDER =================

    let order = await Order.findOne({
      _id: orderId,

      userId: req.userId,

      paymentMode: 'test'
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    const respond = (status, message, extra = {}) =>
      res.status(200).json({
        mode: 'test',

        orderId: order._id,

        status,

        message,

        canRetry: false,

        ...extra
      });

    // ================= LOCAL REFUND PROTECTION =================

    const localRefund = getRefundResponse(order);

    if (localRefund) {
      return respond(
        localRefund.status,
        localRefund.message,
        localRefund
      );
    }

    // ================= ORDER REVIEW PROTECTION =================

    if (
      order.status === 'payment_review' ||
      order.status === 'cancelled'
    ) {
      return respond(
        'review',
        'Order requires reconciliation'
      );
    }

    // ================= INITIALIZE RAZORPAY =================

    const razorpay = getRazorpay();

    let recoveredGatewayOrder = null;

    // ================= GATEWAY ORDER RECOVERY =================

    if (
      !order.razorpayOrderId ||
      order.gatewayCreationStatus !== 'ready'
    ) {

      const recovered = await reconcileGatewayOrder(
        order,
        razorpay
      );

      if (!recovered) {
        return respond(
          'processing',

          'Previous checkout requires gateway reconciliation. Do not pay again.'
        );
      }

      order = recovered.order;

      recoveredGatewayOrder =
        recovered.gatewayOrder;

      // Recheck refund status after reconciliation.

      const recoveredRefund =
        getRefundResponse(order);

      if (recoveredRefund) {
        return respond(
          recoveredRefund.status,

          recoveredRefund.message,

          recoveredRefund
        );
      }

      if (
        order.status === 'payment_review' ||
        order.status === 'cancelled'
      ) {
        return respond(
          'review',

          'Recovered order requires reconciliation'
        );
      }

      if (
        !order.razorpayOrderId ||
        order.gatewayCreationStatus !== 'ready'
      ) {
        return respond(
          'processing',

          'Gateway order recovery is incomplete'
        );
      }

      console.log(
        'Payment status recovered gateway order:',

        String(order._id)
      );
    }

    // ================= FETCH RAZORPAY ORDER =================

    const gatewayOrder =
      recoveredGatewayOrder ||
      await razorpay.orders.fetch(
        order.razorpayOrderId
      );

    // ================= VALIDATE GATEWAY ORDER =================

    if (
      !gatewayOrder ||
      gatewayOrder.id !== order.razorpayOrderId ||
      gatewayOrder.amount !== order.amountPaise ||
      gatewayOrder.currency !== 'INR' ||
      gatewayOrder.partial_payment === true ||
      !['created', 'attempted', 'paid'].includes(
        gatewayOrder.status
      )
    ) {
      return respond(
        'review',

        'Payment details require review'
      );
    }

    // ================= FETCH PAYMENT ATTEMPTS =================

    const result = await razorpay.orders.fetchPayments(
      order.razorpayOrderId,
      { count: 100 }
    );

    if (!Array.isArray(result?.items)) {
      throw new Error('Invalid gateway response');
    }

    const payments = result.items;

    // ================= VALIDATE PAYMENT ATTEMPTS =================

    if (
      payments.some(payment =>
        !payment ||
        typeof payment.id !== 'string' ||
        !payment.id.startsWith('pay_') ||
        payment.order_id !== order.razorpayOrderId ||
        payment.currency !== 'INR' ||
        payment.amount !== order.amountPaise
      )
    ) {
      return respond(
        'review',

        'Payment attempts require reconciliation'
      );
    }

    // ================= INCOMPLETE PAYMENT HISTORY =================

    if (
      payments.length >= 100 ||
      (
        Number.isSafeInteger(gatewayOrder.attempts) &&
        gatewayOrder.attempts > payments.length
      )
    ) {
      return respond(
        'processing',

        'Payment history requires further verification. Do not pay again.'
      );
    }

    // ================= GATEWAY REFUND PROTECTION =================

    const gatewayRefundDetected = payments.some(
      payment =>
        payment.status === 'refunded' ||
        Number(payment.amount_refunded || 0) !== 0 ||
        ['partial', 'full'].includes(
          payment.refund_status
        )
    );

    if (gatewayRefundDetected) {

      // A refund webhook may have updated the local order
      // while this request was checking Razorpay.

      const latestOrder = await Order.findOne({
        _id: order._id,

        userId: req.userId,

        paymentMode: 'test'
      });

      if (latestOrder) {

        order = latestOrder;

        const latestRefund =
          getRefundResponse(order);

        if (latestRefund) {
          return respond(
            latestRefund.status,

            latestRefund.message,

            latestRefund
          );
        }
      }

      return respond(
        'review',

        'Refund detected at Razorpay. Refund reconciliation is required. Do not pay again.'
      );
    }

    // ================= CHECK CAPTURED PAYMENTS =================

    const captured = payments.filter(
      payment => payment.status === 'captured'
    );

    if (captured.length > 1) {
      return respond(
        'review',

        'Multiple captured payments require review'
      );
    }

    // ================= SUCCESSFUL PAYMENT =================

    if (captured.length === 1) {

      const payment = captured[0];

      if (
        payment.order_id !== order.razorpayOrderId ||
        payment.amount !== order.amountPaise ||
        payment.currency !== 'INR' ||
        Number(payment.amount_refunded || 0) !== 0 ||
        (
          order.razorpayPaymentId &&
          order.razorpayPaymentId !== payment.id
        )
      ) {
        return respond(
          'review',

          'Captured payment requires review'
        );
      }

      if (
        gatewayOrder.status !== 'paid' ||
        gatewayOrder.amount_paid !== order.amountPaise
      ) {
        return respond(
          'processing',

          'Captured payment is awaiting gateway confirmation'
        );
      }

      // ================= RECHECK LOCAL ORDER =================

      const latestOrder = await Order.findOne({
        _id: order._id,

        userId: req.userId,

        paymentMode: 'test'
      });

      if (!latestOrder) {
        return respond(
          'review',

          'Local payment order requires review'
        );
      }

      order = latestOrder;

      const latestRefund = getRefundResponse(order);

      if (latestRefund) {
        return respond(
          latestRefund.status,

          latestRefund.message,

          latestRefund
        );
      }

      if (
        order.status === 'cancelled' ||
        order.status === 'payment_review' ||
        order.razorpayOrderId !== payment.order_id ||
        order.amountPaise !== payment.amount
      ) {
        return respond(
          'review',

          'Order status has changed and requires review'
        );
      }

      // ================= FINALIZE PAYMENT =================

      const completedOrder = await finalizePayment(
        order,
        payment
      );

      const completedRefund =
        getRefundResponse(completedOrder);

      if (completedRefund) {
        return respond(
          completedRefund.status,

          completedRefund.message,

          completedRefund
        );
      }

      if (
        completedOrder.status !== 'test_paid' ||
        completedOrder.inventoryUpdated !== true ||
        completedOrder.paymentStatus !== 'captured' ||
        completedOrder.razorpayPaymentId !== payment.id
      ) {
        return respond(
          'review',

          'Payment captured but order requires review'
        );
      }

      return respond(
        'paid',

        'Test payment verified successfully',

        {
          success: true,

          amount: completedOrder.totalAmount,

          transactionId: payment.id,

          order: completedOrder
        }
      );
    }

    // ================= UNCERTAIN PAYMENT PROTECTION =================

    if (
      order.inventoryUpdated ||
      order.paymentStatus === 'captured' ||
      order.paymentStatus === 'authorized' ||
      gatewayOrder.status === 'paid' ||
      gatewayOrder.amount_paid !== 0 ||
      payments.some(
        payment => payment.status !== 'failed'
      )
    ) {
      return respond(
        'processing',

        'Payment status is uncertain. Do not pay again.'
      );
    }

    // ================= SAFE PAYMENT RETRY =================

    if (
      ['created', 'attempted'].includes(
        gatewayOrder.status
      ) &&
      gatewayOrder.amount_paid === 0 &&
      order.checkoutActive === true &&
      order.gatewayCreationStatus === 'ready'
    ) {

      // Recheck the local order before permitting a retry.

      const latestOrder = await Order.findOne({
        _id: order._id,

        userId: req.userId,

        paymentMode: 'test'
      });

      if (!latestOrder) {
        return respond(
          'review',

          'Checkout requires reconciliation'
        );
      }

      const latestRefund =
        getRefundResponse(latestOrder);

      if (latestRefund) {
        return respond(
          latestRefund.status,

          latestRefund.message,

          latestRefund
        );
      }

      if (
        latestOrder.checkoutActive !== true ||
        latestOrder.inventoryUpdated ||
        latestOrder.status !== 'pending' ||
        latestOrder.paymentStatus !== 'pending' ||
        latestOrder.gatewayCreationStatus !== 'ready' ||
        latestOrder.razorpayOrderId !==
          order.razorpayOrderId ||
        latestOrder.amountPaise !== gatewayOrder.amount ||
        latestOrder.razorpayPaymentId
      ) {
        return respond(
          'processing',

          'Order status has changed. Check payment status again.'
        );
      }

      // ================= FINAL GATEWAY RECHECK =================

      const finalGatewayOrder =
        await razorpay.orders.fetch(
          latestOrder.razorpayOrderId
        );

      if (
        !finalGatewayOrder ||
        finalGatewayOrder.id !==
          latestOrder.razorpayOrderId ||
        finalGatewayOrder.amount !==
          latestOrder.amountPaise ||
        finalGatewayOrder.currency !== 'INR' ||
        finalGatewayOrder.partial_payment === true ||
        !['created', 'attempted'].includes(
          finalGatewayOrder.status
        ) ||
        finalGatewayOrder.amount_paid !== 0 ||
        !Number.isSafeInteger(
          finalGatewayOrder.attempts
        ) ||
        finalGatewayOrder.attempts !==
          gatewayOrder.attempts ||
        finalGatewayOrder.attempts !== payments.length
      ) {
        return respond(
          'processing',

          'Gateway payment status has changed. Check again before retrying.'
        );
      }

      // Retry the same gateway order, never a new order.

      return respond(
        'unpaid',

        'No successful payment found. Retry the same order.',

        {
          canRetry: true,

          keyId: process.env.RAZORPAY_KEY_ID,

          razorpayOrderId:
            latestOrder.razorpayOrderId,

          amount: latestOrder.amountPaise,

          currency: 'INR'
        }
      );
    }

    return respond(
      'processing',

      'Payment requires further verification'
    );

  } catch (err) {

    console.error(
      'Payment status error:',

      err.statusCode || err.name
    );

    return res.status(503).json({
      message:
        'Unable to confirm payment status. Do not pay again.'
    });
  }
};

// ================= ACTIVE CHECKOUT RECOVERY =================

exports.getActiveCheckout = async (req, res) => {

  try {

    // ================= TEST MODE PROTECTION =================

    if (!isSafePaymentEnvironment()) {
      return res.status(503).json({
        message: 'Checkout recovery unavailable'
      });
    }

    res.set('Cache-Control', 'no-store');

    // ================= FIND ACTIVE CHECKOUT =================

    const order = await Order.findOne({
      userId: req.userId,

      paymentMode: 'test',

      $or: [

        // Preserve any explicitly locked checkout.

        {
          checkoutActive: true
        },

        // Recover older unresolved payment orders.

        {
          status: {
            $in: ['pending', 'payment_review']
          },

          inventoryUpdated: {
            $ne: true
          }
        }
      ]
    }).sort({
      checkoutActive: -1,

      createdAt: -1
    });

    // ================= NO ACTIVE CHECKOUT =================

    if (!order) {
      return res.status(200).json({
        active: false,

        mode: 'test'
      });
    }

    // ================= RETURN RECOVERY DETAILS =================

    return res.status(200).json({
      active: true,

      mode: 'test',

      orderId: order._id,

      amount: order.amountPaise,

      status: order.status,

      paymentStatus: order.paymentStatus,

      refundStatus:
        order.refundStatus || 'none',

      refundedAmountPaise:
        order.refundedAmountPaise || 0,

      gatewayCreationStatus:
        order.gatewayCreationStatus || 'unknown'
    });

  } catch (err) {

    console.error(
      'Checkout recovery error:',

      err.name
    );

    return res.status(503).json({
      message: 'Unable to recover checkout safely'
    });
  }
};
