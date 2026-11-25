
const mongoose = require('mongoose');
const crypto = require('crypto');

const getRazorpay = require('../config/razorpay');

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const {
  finalizePayment
} = require('../services/paymentService');

// ================= TEST MODE PROTECTION =================

function ensureTestMode() {
  if (
    process.env.PAYMENT_MODE !== 'test' ||
    mongoose.connection.name !== 'shopeasy_payment_test'
  ) {
    throw new Error('Unsafe payment environment');
  }
}

// ================= REFUND PROTECTION =================

function hasRefundRestriction(order) {
  return (
    order.status === 'refunded' ||
    order.paymentStatus === 'refunded' ||
    Number(order.refundedAmountPaise || 0) > 0 ||
    ['pending', 'partial', 'refunded'].includes(
      order.refundStatus
    )
  );
}

// ================= CHECKOUT RESPONSE =================

function checkoutResponse(res, order, status = 200) {
  return res.status(status).json({
    message: 'Razorpay test order ready',
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order._id,
    razorpayOrderId: order.razorpayOrderId,
    amount: order.amountPaise,
    currency: 'INR',
    mode: 'test'
  });
}

// ================= GATEWAY ORDER VALIDATION =================

function validateGatewayOrder(
  order,
  gatewayOrder,
  requireReceipt = true
) {
  if (
    !gatewayOrder ||
    typeof gatewayOrder.id !== 'string' ||
    !gatewayOrder.id.startsWith('order_') ||
    gatewayOrder.amount !== order.amountPaise ||
    gatewayOrder.currency !== 'INR' ||
    gatewayOrder.partial_payment === true ||
    (
      requireReceipt &&
      gatewayOrder.receipt !== `SE_${order._id}`
    ) ||
    (
      order.razorpayOrderId &&
      gatewayOrder.id !== order.razorpayOrderId
    ) ||
    !['created', 'attempted', 'paid'].includes(
      gatewayOrder.status
    )
  ) {
    throw new Error('Gateway order validation failed');
  }

  return gatewayOrder;
}

// ================= STORE GATEWAY ORDER SAFELY =================

async function attachGatewayOrder(order, gatewayOrder) {

  ensureTestMode();

  validateGatewayOrder(order, gatewayOrder);

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      userId: order.userId,
      paymentMode: 'test',
      checkoutActive: true,

      $or: [
        {
          razorpayOrderId: {
            $exists: false
          }
        },
        {
          razorpayOrderId: null
        },
        {
          razorpayOrderId: ''
        },
        {
          razorpayOrderId: gatewayOrder.id
        }
      ]
    },
    {
      $set: {
        razorpayOrderId: gatewayOrder.id,
        gatewayCreationStatus: 'ready'
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!updatedOrder) {
    throw new Error(
      'Unable to attach gateway order safely'
    );
  }

  return updatedOrder;
}

// ================= GATEWAY RECONCILIATION =================

async function reconcileGatewayOrder(order, razorpay) {

  ensureTestMode();

  if (!order || order.paymentMode !== 'test') {
    throw new Error('Invalid reconciliation order');
  }

  const latestOrder = await Order.findOne({
    _id: order._id,
    userId: order.userId,
    paymentMode: 'test'
  });

  if (!latestOrder) {
    throw new Error('Local order not found');
  }

  // Gateway order ID has already been saved.

  if (latestOrder.razorpayOrderId) {

    const gatewayOrder = await razorpay.orders.fetch(
      latestOrder.razorpayOrderId
    );

    validateGatewayOrder(
      latestOrder,
      gatewayOrder,
      false
    );

    if (
      latestOrder.gatewayCreationStatus !== 'ready'
    ) {

      const updatedOrder = await attachGatewayOrder(
        latestOrder,
        gatewayOrder
      );

      return {
        order: updatedOrder,
        gatewayOrder
      };
    }

    return {
      order: latestOrder,
      gatewayOrder
    };
  }

  // Never create a replacement for an uncertain order.

  if (
    latestOrder.checkoutActive !== true ||
    latestOrder.status !== 'pending' ||
    latestOrder.inventoryUpdated ||
    hasRefundRestriction(latestOrder)
  ) {
    return null;
  }

  if (
    !['creating', 'unknown'].includes(
      latestOrder.gatewayCreationStatus
    )
  ) {
    return null;
  }

  const receipt = `SE_${latestOrder._id}`;

  // Find the original Razorpay order using its receipt.

  const result = await razorpay.orders.all({
    receipt,
    count: 100
  });

  if (!Array.isArray(result?.items)) {
    throw new Error(
      'Invalid gateway reconciliation response'
    );
  }

  // Fail closed if the response is ambiguous or truncated.

  if (result.items.length >= 100) {
    throw new Error(
      'Gateway reconciliation requires further review'
    );
  }

  const matchedOrders = result.items.filter(
    gatewayOrder =>
      gatewayOrder.receipt === receipt
  );

  // No match does not prove an order was never created.

  if (matchedOrders.length === 0) {
    return null;
  }

  if (matchedOrders.length !== 1) {
    throw new Error(
      'Multiple gateway orders require reconciliation'
    );
  }

  const matchedOrder = matchedOrders[0];

  validateGatewayOrder(
    latestOrder,
    matchedOrder
  );

  // Fetch the exact gateway order independently.

  const gatewayOrder = await razorpay.orders.fetch(
    matchedOrder.id
  );

  validateGatewayOrder(
    latestOrder,
    gatewayOrder
  );

  if (gatewayOrder.id !== matchedOrder.id) {
    throw new Error(
      'Recovered gateway order ID mismatch'
    );
  }

  const recoveredOrder = await attachGatewayOrder(
    latestOrder,
    gatewayOrder
  );

  console.log(
    'Razorpay gateway order recovered:',
    String(recoveredOrder._id)
  );

  return {
    order: recoveredOrder,
    gatewayOrder
  };
}

// Export so paymentStatusController can also recover orders.

exports.reconcileGatewayOrder = reconcileGatewayOrder;

// ================= CART SNAPSHOT =================

async function buildCheckoutSnapshot(userId, session) {

  let cartQuery = Cart.findOne({ userId });

  if (session) {
    cartQuery = cartQuery.session(session);
  }

  const cart = await cartQuery;

  if (
    !cart ||
    !Array.isArray(cart.items) ||
    !cart.items.length
  ) {
    const err = new Error('Cart is empty');
    err.status = 400;
    throw err;
  }

  const quantities = new Map();

  for (const item of cart.items) {

    if (
      !mongoose.isValidObjectId(item.productId) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    ) {
      const err = new Error(
        'Invalid product quantity or ID'
      );

      err.status = 400;

      throw err;
    }

    const id = String(item.productId);

    const quantity =
      (quantities.get(id) || 0) +
      item.quantity;

    if (!Number.isSafeInteger(quantity)) {
      const err = new Error(
        'Invalid combined product quantity'
      );

      err.status = 400;

      throw err;
    }

    quantities.set(id, quantity);
  }

  const orderItems = [];

  let totalPaise = 0;

  for (const [productId, quantity] of quantities) {

    let productQuery = Product.findOne({
      _id: productId,
      isActive: { $ne: false }
    });

    if (session) {
      productQuery = productQuery.session(session);
    }

    const product = await productQuery;

    if (
      !product ||
      !Number.isSafeInteger(product.stock) ||
      product.stock < quantity
    ) {
      const err = new Error(
        'Product unavailable or insufficient stock'
      );

      err.status = 400;

      throw err;
    }

    if (
      !Number.isFinite(product.price) ||
      product.price <= 0
    ) {
      const err = new Error(
        'Invalid product price'
      );

      err.status = 400;

      throw err;
    }

    const pricePaise = Math.round(
      product.price * 100
    );

    const itemTotal = pricePaise * quantity;

    if (
      !Number.isSafeInteger(pricePaise) ||
      pricePaise < 1 ||
      !Number.isSafeInteger(itemTotal)
    ) {
      const err = new Error(
        'Invalid product amount'
      );

      err.status = 400;

      throw err;
    }

    orderItems.push({
      productId: product._id,
      name: product.name,
      price: pricePaise / 100,
      quantity
    });

    totalPaise += itemTotal;
  }

  if (
    !Number.isSafeInteger(totalPaise) ||
    totalPaise < 100
  ) {
    const err = new Error(
      'Invalid checkout total'
    );

    err.status = 400;

    throw err;
  }

  const fingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        orderItems
          .map(item => ({
            id: String(item.productId),
            price: Math.round(item.price * 100),
            quantity: item.quantity
          }))
          .sort(
            (a, b) => a.id.localeCompare(b.id)
          )
      )
    )
    .digest('hex');

  return {
    orderItems,
    totalPaise,
    fingerprint
  };
}

// ================= CREATE PAYMENT ORDER =================

exports.createPaymentOrder = async (req, res) => {

  let reservedOrder = null;

  try {

    ensureTestMode();

    res.set('Cache-Control', 'no-store');

    const razorpay = getRazorpay();

    const userId = req.userId;

    const expectedAmount = req.body?.expectedAmount;

    if (
      typeof expectedAmount !== 'number' ||
      !Number.isFinite(expectedAmount) ||
      expectedAmount <= 0 ||
      !Number.isSafeInteger(
        Math.round(expectedAmount * 100)
      )
    ) {
      return res.status(400).json({
        message: 'Invalid checkout amount'
      });
    }

    // ================= EXISTING CHECKOUT =================

    let existingOrder = await Order.findOne({
      userId,
      paymentMode: 'test',
      checkoutActive: true
    });

    if (existingOrder) {

      if (
        hasRefundRestriction(existingOrder) ||
        existingOrder.status !== 'pending' ||
        existingOrder.inventoryUpdated ||
        existingOrder.paymentStatus !== 'pending'
      ) {
        return res.status(409).json({
          message: 'Existing checkout requires reconciliation'
        });
      }

      const snapshot = await buildCheckoutSnapshot(
        userId
      );

      if (
        snapshot.totalPaise !==
          Math.round(expectedAmount * 100) ||
        existingOrder.amountPaise !==
          snapshot.totalPaise ||
        existingOrder.checkoutFingerprint !==
          snapshot.fingerprint
      ) {
        return res.status(409).json({
          message: 'An existing checkout requires resolution'
        });
      }

      // Recover the existing gateway order if necessary.

      const recovered = await reconcileGatewayOrder(
        existingOrder,
        razorpay
      );

      if (!recovered) {
        return res.status(409).json({
          message: 'Previous checkout is processing or requires review'
        });
      }

      existingOrder = recovered.order;

      const gatewayOrder = recovered.gatewayOrder;

      if (
        gatewayOrder.status !== 'created' ||
        gatewayOrder.amount_paid !== 0 ||
        gatewayOrder.attempts !== 0
      ) {
        return res.status(409).json({
          message: 'Previous payment requires reconciliation'
        });
      }

      const latestOrder = await Order.findOne({
        _id: existingOrder._id,
        userId,
        paymentMode: 'test'
      });

      if (
        !latestOrder ||
        latestOrder.checkoutActive !== true ||
        latestOrder.status !== 'pending' ||
        latestOrder.paymentStatus !== 'pending' ||
        latestOrder.inventoryUpdated ||
        latestOrder.gatewayCreationStatus !== 'ready' ||
        latestOrder.razorpayOrderId !== gatewayOrder.id ||
        hasRefundRestriction(latestOrder)
      ) {
        return res.status(409).json({
          message: 'Checkout status has changed'
        });
      }

      return checkoutResponse(
        res,
        latestOrder
      );
    }

    // ================= RESERVE LOCAL CHECKOUT =================

    const session = await mongoose.startSession();

    try {

      await session.withTransaction(async () => {

        reservedOrder = null;

        const activeOrder = await Order.findOne({
          userId,
          paymentMode: 'test',
          checkoutActive: true
        }).session(session);

        if (activeOrder) {
          const err = new Error(
            'Another checkout is already processing'
          );

          err.status = 409;

          throw err;
        }

        // Protect older unresolved payment orders.

        const legacyOrder = await Order.findOne({
          userId,
          paymentMode: 'test',

          status: {
            $in: ['pending', 'payment_review']
          },

          inventoryUpdated: {
            $ne: true
          }
        }).session(session);

        if (legacyOrder) {
          const err = new Error(
            'An earlier payment requires reconciliation'
          );

          err.status = 409;

          throw err;
        }

        const snapshot = await buildCheckoutSnapshot(
          userId,
          session
        );

        if (
          snapshot.totalPaise !==
          Math.round(expectedAmount * 100)
        ) {
          const err = new Error(
            'Checkout total has changed'
          );

          err.status = 400;

          throw err;
        }

        const createdOrders = await Order.create(
          [
            {
              userId,

              items: snapshot.orderItems,

              totalAmount:
                snapshot.totalPaise / 100,

              amountPaise:
                snapshot.totalPaise,

              currency: 'INR',

              status: 'pending',

              paymentStatus: 'pending',

              paymentMode: 'test',

              paymentMethod: 'RAZORPAY',

              inventoryUpdated: false,

              checkoutActive: true,

              checkoutFingerprint:
                snapshot.fingerprint,

              gatewayCreationStatus: 'creating',

              refundStatus: 'none',

              refundedAmountPaise: 0
            }
          ],
          {
            session
          }
        );

        reservedOrder = createdOrders[0];
      });

    } finally {

      await session.endSession();
    }

    if (!reservedOrder) {
      throw new Error(
        'Local checkout reservation failed'
      );
    }

    // ================= CREATE GATEWAY ORDER =================

    const gatewayOrder = await razorpay.orders.create({
      amount: reservedOrder.amountPaise,
      currency: 'INR',

      receipt: `SE_${reservedOrder._id}`,

      partial_payment: false
    });

    validateGatewayOrder(
      reservedOrder,
      gatewayOrder
    );

    const readyOrder = await attachGatewayOrder(
      reservedOrder,
      gatewayOrder
    );

    if (
      readyOrder.checkoutActive !== true ||
      readyOrder.status !== 'pending' ||
      readyOrder.paymentStatus !== 'pending' ||
      readyOrder.inventoryUpdated ||
      hasRefundRestriction(readyOrder) ||
      gatewayOrder.status !== 'created' ||
      gatewayOrder.amount_paid !== 0
    ) {
      return res.status(409).json({
        message: 'Payment order requires reconciliation'
      });
    }

    return checkoutResponse(
      res,
      readyOrder,
      201
    );

  } catch (err) {

    // Preserve uncertain reservations instead of deleting
    // them or creating another gateway order.

    if (reservedOrder) {

      try {

        await Order.updateOne(
          {
            _id: reservedOrder._id,

            paymentMode: 'test',

            checkoutActive: true,

            gatewayCreationStatus: 'creating'
          },
          {
            $set: {
              gatewayCreationStatus: 'unknown'
            }
          }
        );

      } catch (updateError) {

        console.error(
          'Checkout reconciliation required:',
          String(reservedOrder._id)
        );
      }
    }

    if (err.code === 11000) {
      return res.status(409).json({
        message: 'Another checkout request is already processing'
      });
    }

    if ([400, 409].includes(err.status)) {
      return res.status(err.status).json({
        message: err.message
      });
    }

    console.error(
      'Razorpay order creation failed:',
      err.statusCode || err.name
    );

    return res.status(503).json({
      message: 'Unable to create payment order safely. Check your existing checkout before retrying.'
    });
  }
};

// ================= VERIFY PAYMENT =================

exports.verifyPayment = async (req, res) => {

  try {

    ensureTestMode();

    res.set('Cache-Control', 'no-store');

    const razorpay = getRazorpay();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (
      typeof razorpay_order_id !== 'string' ||
      !razorpay_order_id.startsWith('order_') ||
      typeof razorpay_payment_id !== 'string' ||
      !razorpay_payment_id.startsWith('pay_') ||
      typeof razorpay_signature !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(razorpay_signature)
    ) {
      return res.status(400).json({
        message: 'Invalid payment details'
      });
    }

    const order = await Order.findOne({
      userId: req.userId,

      razorpayOrderId: razorpay_order_id,

      paymentMode: 'test'
    });

    if (!order) {
      return res.status(404).json({
        message: 'Order not found'
      });
    }

    // ================= SIGNATURE VERIFICATION =================

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        order.razorpayOrderId +
        '|' +
        razorpay_payment_id
      )
      .digest('hex');

    const validSignature = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (!validSignature) {
      return res.status(400).json({
        message: 'Invalid payment signature'
      });
    }

    // ================= LOCAL REFUND PROTECTION =================

    if (hasRefundRestriction(order)) {
      return res.status(409).json({
        message: 'This order has a refund and cannot be processed again',

        refundStatus: order.refundStatus,

        refundedAmountPaise:
          order.refundedAmountPaise || 0
      });
    }

    if (
      order.status === 'cancelled' ||
      order.status === 'payment_review'
    ) {
      return res.status(409).json({
        message: 'Order requires reconciliation'
      });
    }

    // ================= VERIFY GATEWAY PAYMENT =================

    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      payment.id !== razorpay_payment_id ||
      payment.order_id !== order.razorpayOrderId ||
      payment.amount !== order.amountPaise ||
      payment.currency !== 'INR'
    ) {
      return res.status(400).json({
        message: 'Payment details do not match order'
      });
    }

    // ================= GATEWAY REFUND PROTECTION =================

    if (
      payment.status === 'refunded' ||
      Number(payment.amount_refunded || 0) !== 0
    ) {
      return res.status(409).json({
        message: 'Refund detected. Payment requires reconciliation'
      });
    }

    if (payment.status !== 'captured') {
      return res.status(409).json({
        message: 'Payment is not captured yet'
      });
    }

    // ================= GATEWAY ORDER VERIFICATION =================

    const gatewayOrder = await razorpay.orders.fetch(
      order.razorpayOrderId
    );

    validateGatewayOrder(
      order,
      gatewayOrder,
      false
    );

    if (
      gatewayOrder.status !== 'paid' ||
      gatewayOrder.amount_paid !== order.amountPaise
    ) {
      return res.status(409).json({
        message: 'Gateway order requires reconciliation'
      });
    }

    // ================= FINALIZE PAYMENT =================

    const completedOrder = await finalizePayment(
      order,
      payment
    );

    if (
      !completedOrder.inventoryUpdated ||
      completedOrder.status !== 'test_paid' ||
      completedOrder.paymentStatus !== 'captured' ||
      hasRefundRestriction(completedOrder)
    ) {
      return res.status(409).json({
        message: 'Payment captured but order requires review',

        status: 'payment_review'
      });
    }

    return res.status(200).json({
      message: 'Test payment verified successfully',

      success: true,

      mode: 'test',

      amount: completedOrder.totalAmount,

      transactionId: payment.id,

      order: completedOrder
    });

  } catch (err) {

    console.error(
      'Payment verification error:',
      err.statusCode || err.name
    );

    return res.status(503).json({
      message: 'Unable to complete payment verification. Do not pay again.'
    });
  }
};
