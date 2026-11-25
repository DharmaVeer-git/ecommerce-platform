
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
  getCart,
  createRazorpayOrder,
  verifyRazorpayPayment,
  getPaymentStatus,
  getActiveCheckout
} from '../api';

import './CartCheckout.css';

// ================= FORMAT HELPERS =================

const rupee = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  })}`;

const isOrderId = (id) =>
  typeof id === 'string' &&
  /^[a-f0-9]{24}$/i.test(id);

// ================= CHECKOUT STEPS =================

function Steps({ stage }) {
  const steps = [
    { key: 'order', label: 'Creating payment order' },
    { key: 'payment', label: 'Complete Razorpay payment' },
    { key: 'verify', label: 'Verifying your payment' }
  ];

  const order = ['order', 'payment', 'verify', 'done'];

  return (
    <div className="sx-steps" role="status" aria-live="polite">
      {steps.map((s) => {
        const state =
          order.indexOf(stage) > order.indexOf(s.key)
            ? 'done'
            : stage === s.key
            ? 'active'
            : '';

        return (
          <div key={s.key} className={`sx-step ${state}`}>
            <span className="mark">
              {state === 'done' ? '✓' : ''}
            </span>

            {s.label}
          </div>
        );
      })}
    </div>
  );
}

// ================= ACCOUNT STORAGE KEY =================

function getStorageKey(token) {
  try {
    const payload = token.split('.')[1];

    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decoded = JSON.parse(atob(base64));

    if (isOrderId(decoded.id)) {
      return `shopeasy_test_checkout_${decoded.id}`;
    }

  } catch {
    // Server authentication remains authoritative.
  }

  return null;
}

// ================= CHECKOUT COMPONENT =================

function Checkout() {

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [receipt, setReceipt] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

  const [activeOrder, setActiveOrder] = useState(null);
  const [retryData, setRetryData] = useState(null);
  const [blocked, setBlocked] = useState(true);

  const [recoveredAmount, setRecoveredAmount] =
    useState(null);

  const [refundInfo, setRefundInfo] = useState(null);

  const checkoutLock = useRef(false);
  const mounted = useRef(false);

  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  const storageKey = getStorageKey(token || '');

  const sessionValid = () =>
    mounted.current &&
    Boolean(token) &&
    localStorage.getItem('token') === token;

  const total = items.reduce(
    (sum, item) =>
      sum + Number(item.price) * Number(item.quantity),
    0
  );

  const displayedTotal =
    activeOrder && recoveredAmount !== null
      ? recoveredAmount / 100
      : total;

  const busy = [
    'order',
    'payment',
    'verify'
  ].includes(stage);

  // ================= STORAGE HELPERS =================

  const saveCheckout = (orderId) => {
    if (
      !storageKey ||
      !sessionValid() ||
      !isOrderId(orderId)
    ) return;

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ orderId })
      );

    } catch {
      // Server-side recovery remains available.
    }
  };

  const readSavedCheckout = () => {
    if (!storageKey) return null;

    try {
      const saved = JSON.parse(
        localStorage.getItem(storageKey) || 'null'
      );

      return isOrderId(saved?.orderId)
        ? saved.orderId
        : null;

    } catch {
      return null;
    }
  };

  const clearSavedCheckout = (orderId) => {
    if (!storageKey || !sessionValid()) return;

    try {
      const saved = readSavedCheckout();

      // Do not delete another checkout created in a different tab.

      if (saved === orderId) {
        localStorage.removeItem(storageKey);
      }

    } catch {
      // Server-side recovery remains authoritative.
    }
  };

  // ================= VALIDATE SERVER RESPONSES =================

  const validateRecovery = (data) => {
    if (
      data?.mode !== 'test' ||
      typeof data.active !== 'boolean' ||
      (data.active && !isOrderId(data.orderId))
    ) {
      throw new Error('Invalid checkout recovery response');
    }

    return data;
  };

  const validateStatus = (data, orderId) => {
    if (
      data?.mode !== 'test' ||
      String(data.orderId) !== String(orderId)
    ) {
      throw new Error('Invalid payment status response');
    }

    return data;
  };

  const applyRecoveredOrder = (data) => {
    saveCheckout(data.orderId);

    setActiveOrder(data.orderId);

    setRecoveredAmount(
      Number.isSafeInteger(data.amount) &&
      data.amount > 0
        ? data.amount
        : null
    );

    setBlocked(true);
    setRetryData(null);
    setPaymentData(null);
    setRefundInfo(null);
  };

  // ================= LOAD CURRENT CART =================

  const refreshCart = async () => {
    const response = await getCart(token);

    const cartItems = response.data?.items;

    if (!Array.isArray(cartItems)) {
      throw new Error('Invalid cart response');
    }

    return cartItems;
  };

  // ================= PAYMENT SUCCESS =================

  const completeOrder = (data, expectedOrderId) => {
    if (!sessionValid()) return;

    if (
      data.success !== true ||
      data.mode !== 'test' ||
      data.order?.inventoryUpdated !== true ||
      data.order?.status !== 'test_paid' ||
      data.order?.paymentStatus !== 'captured' ||
      String(data.order?._id) !== String(expectedOrderId) ||
      Number(data.order?.refundedAmountPaise || 0) > 0 ||
      ['pending', 'partial', 'refunded'].includes(
        data.order?.refundStatus
      )
    ) {
      throw new Error('Payment confirmation incomplete');
    }

    clearSavedCheckout(expectedOrderId);

    setReceipt({
      amount: data.amount,
      transactionId: data.transactionId
    });

    setPaymentData(null);
    setActiveOrder(null);
    setRetryData(null);
    setRecoveredAmount(null);
    setRefundInfo(null);
    setBlocked(false);
    setError('');
    setNotice('');
    setItems([]);
    setStage('done');
  };

  // ================= FULL REFUND CLEANUP =================

  const cleanupRefundedCheckout = async (
    orderId,
    data,
    isCancelled = () => false
  ) => {

    setBlocked(true);
    setRetryData(null);
    setPaymentData(null);

    setRefundInfo({
      status: 'refunded',
      amount: data.refundedAmountPaise
    });

    const recoveryResponse =
      await getActiveCheckout(token);

    if (!sessionValid() || isCancelled()) return;

    const recovery = validateRecovery(
      recoveryResponse.data
    );

    // Never unlock checkout if another active order exists.

    if (recovery.active) {

      if (recovery.orderId !== orderId) {

        clearSavedCheckout(orderId);

        applyRecoveredOrder(recovery);

        setNotice(
          'Your previous order was refunded. Another unfinished checkout was found.'
        );

        setError(
          'Check the recovered order before making another payment.'
        );

      } else {

        setError(
          'Your refund is recorded, but this checkout still requires reconciliation.'
        );
      }

      setStage('idle');
      return;
    }

    // Reload the current cart before allowing a new checkout.

    const cartItems = await refreshCart();

    if (!sessionValid() || isCancelled()) return;

    // Check again in case another checkout appeared during cart loading.

    const finalResponse = await getActiveCheckout(token);

    if (!sessionValid() || isCancelled()) return;

    const finalRecovery = validateRecovery(
      finalResponse.data
    );

    if (finalRecovery.active) {

      applyRecoveredOrder(finalRecovery);

      setStage('idle');

      setError(
        'An active checkout was found. Check its payment status.'
      );

      return;
    }

    const savedOrder = readSavedCheckout();

    if (savedOrder && savedOrder !== orderId) {

      setActiveOrder(savedOrder);
      setRecoveredAmount(null);
      setBlocked(true);
      setStage('idle');

      setError(
        'Another saved checkout was found. Verify it before continuing.'
      );

      return;
    }

    clearSavedCheckout(orderId);

    setItems(cartItems);
    setActiveOrder(null);
    setRecoveredAmount(null);
    setRetryData(null);
    setPaymentData(null);
    setReceipt(null);

    setBlocked(false);
    setStage('idle');
    setError('');

    setNotice(
      'Your previous test payment was fully refunded. Review your current cart before starting a new checkout.'
    );
  };

  // ================= REFUND STATUS HANDLING =================

  const handleRefundStatus = async (
    orderId,
    data,
    isCancelled = () => false
  ) => {

    if (!sessionValid() || isCancelled()) {
      return true;
    }

    if (data.status === 'refunded') {

      await cleanupRefundedCheckout(
        orderId,
        data,
        isCancelled
      );

      return true;
    }

    if (
      data.status === 'partially_refunded' ||
      data.status === 'refund_pending'
    ) {

      setBlocked(true);
      setRetryData(null);
      setPaymentData(null);

      setRefundInfo({
        status: data.status,
        amount: data.refundedAmountPaise
      });

      setStage('idle');

      setError(
        data.message ||
        'This order has a refund. Do not pay again.'
      );

      return true;
    }

    return false;
  };

  // ================= CHECK PAYMENT STATUS =================

  const checkStatus = async (
    orderId,
    isCancelled = () => false
  ) => {

    if (
      !isOrderId(orderId) ||
      checkoutLock.current ||
      !sessionValid() ||
      isCancelled()
    ) return;

    checkoutLock.current = true;

    setStage('verify');
    setBlocked(true);
    setRetryData(null);
    setError('');

    try {

      const response = await getPaymentStatus(
        token,
        orderId
      );

      if (!sessionValid() || isCancelled()) return;

      const data = validateStatus(
        response.data,
        orderId
      );

      const refundHandled = await handleRefundStatus(
        orderId,
        data,
        isCancelled
      );

      if (
        refundHandled ||
        !sessionValid() ||
        isCancelled()
      ) return;

      if (data.status === 'paid') {

        completeOrder(data, orderId);

        return;
      }

      if (
        data.status === 'unpaid' &&
        data.canRetry === true
      ) {

        setRefundInfo(null);
        setPaymentData(null);
        setRetryData(data);
        setRecoveredAmount(data.amount);

        setError(
          'No successful payment found. You can retry the same order.'
        );

      } else {

        setError(
          data.message ||
          'Payment requires further verification.'
        );
      }

      setStage('idle');

    } catch (err) {

      if (!sessionValid() || isCancelled()) return;

      setBlocked(true);
      setStage('idle');

      setError(
        err.response?.data?.message ||
        err.message ||
        'Unable to confirm payment status. Do not pay again.'
      );

    } finally {

      checkoutLock.current = false;
    }
  };

  // ================= INITIALIZE CHECKOUT =================

  useEffect(() => {

    mounted.current = true;

    if (!token) {
      navigate('/login', { replace: true });

      return () => {
        mounted.current = false;
      };
    }

    let cancelled = false;

    const initialize = async () => {

      setLoading(true);
      setBlocked(true);
      setError('');
      setNotice('');
      setItems([]);
      setReceipt(null);
      setPaymentData(null);
      setActiveOrder(null);
      setRetryData(null);
      setRefundInfo(null);
      setRecoveredAmount(null);
      setStage('idle');

      try {

        const cartItems = await refreshCart();

        if (cancelled || !sessionValid()) return;

        setItems(cartItems);

        const recoveryResponse =
          await getActiveCheckout(token);

        if (cancelled || !sessionValid()) return;

        const data = validateRecovery(
          recoveryResponse.data
        );

        // Recover active checkout from the backend first.

        if (data.active) {

          applyRecoveredOrder(data);

          await checkStatus(
            data.orderId,
            () => cancelled
          );

          return;
        }

        // Recover previously saved checkout.

        const savedOrderId = readSavedCheckout();

        if (savedOrderId) {

          setActiveOrder(savedOrderId);

          await checkStatus(
            savedOrderId,
            () => cancelled
          );

          return;
        }

        // No unfinished checkout found.

        setActiveOrder(null);
        setRecoveredAmount(null);
        setBlocked(false);

      } catch (err) {

        if (!cancelled && sessionValid()) {

          setBlocked(true);

          setError(
            err.response?.data?.message ||
            'Unable to recover checkout safely. Refresh and try again.'
          );
        }

      } finally {

        if (!cancelled && sessionValid()) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
      mounted.current = false;
    };

  }, [token, navigate]);

  // ================= VERIFY PAYMENT =================

  const confirmPayment = async (
    response,
    expectedOrderId
  ) => {

    if (!sessionValid()) {
      checkoutLock.current = false;
      return;
    }

    setStage('verify');
    setBlocked(true);
    setError('');
    setPaymentData(response);

    try {

      const result = await verifyRazorpayPayment(
        token,
        response
      );

      if (!sessionValid()) return;

      completeOrder(
        result.data,
        expectedOrderId
      );

    } catch (err) {

      if (!sessionValid()) return;

      setStage('idle');

      setError(
        (
          err.response?.data?.message ||
          'Payment verification could not be completed.'
        ) +
        ' Do not pay again. Check payment status.'
      );

    } finally {

      checkoutLock.current = false;
    }
  };

  // ================= RETRY VERIFICATION =================

  const retryVerification = async () => {

    if (
      !paymentData ||
      !activeOrder ||
      refundInfo ||
      checkoutLock.current ||
      !sessionValid()
    ) return;

    // Check the current server state instead of blindly
    // resubmitting an old payment confirmation.

    await checkStatus(activeOrder);
  };

  // ================= OPEN RAZORPAY =================

  const openRazorpay = (data) => {

    if (!sessionValid()) {
      throw new Error('Your login session has changed');
    }

    if (
      data.mode !== 'test' ||
      !data.keyId?.startsWith('rzp_test_') ||
      !data.razorpayOrderId ||
      !isOrderId(data.orderId) ||
      data.currency !== 'INR' ||
      !Number.isSafeInteger(data.amount) ||
      data.amount < 100
    ) {
      throw new Error('Invalid test payment configuration');
    }

    saveCheckout(data.orderId);

    setActiveOrder(data.orderId);
    setRecoveredAmount(data.amount);
    setRetryData(null);
    setPaymentData(null);
    setRefundInfo(null);
    setNotice('');
    setBlocked(true);

    if (!window.Razorpay) {
      throw new Error('Razorpay could not load');
    }

    let verificationStarted = false;
    let dismissed = false;

    const options = {

      key: data.keyId,
      amount: data.amount,
      currency: data.currency,
      name: 'ShopEasy',
      description: 'ShopEasy Test Order',
      order_id: data.razorpayOrderId,

      theme: {
        color: '#7954de'
      },

      handler: async function (response) {

        if (
          verificationStarted ||
          !sessionValid()
        ) return;

        verificationStarted = true;

        checkoutLock.current = true;

        await confirmPayment(
          {
            razorpay_order_id:
              response.razorpay_order_id,

            razorpay_payment_id:
              response.razorpay_payment_id,

            razorpay_signature:
              response.razorpay_signature
          },
          data.orderId
        );
      },

      modal: {

        ondismiss: function () {

          if (
            verificationStarted ||
            dismissed ||
            !sessionValid()
          ) return;

          dismissed = true;

          checkoutLock.current = false;

          setStage('idle');
          setBlocked(true);

          setError(
            'Payment window closed. Check payment status before retrying.'
          );
        }
      }
    };

    const razorpay = new window.Razorpay(options);

    razorpay.on(
      'payment.failed',
      function (response) {

        if (
          verificationStarted ||
          dismissed ||
          !sessionValid()
        ) return;

        setError(
          response.error?.description ||
          'Payment failed. Close the window and check payment status.'
        );
      }
    );

    setStage('payment');

    razorpay.open();
  };

  // ================= RECOVER EXISTING CHECKOUT =================

  const recoverCheckout = async () => {

    if (
      checkoutLock.current ||
      !sessionValid()
    ) return;

    checkoutLock.current = true;

    setBlocked(true);
    setStage('verify');
    setError('');

    let recoveredOrderId = null;

    try {

      const response = await getActiveCheckout(token);

      if (!sessionValid()) return;

      const data = validateRecovery(response.data);

      if (data.active) {

        recoveredOrderId = data.orderId;

        applyRecoveredOrder(data);

      } else {

        const savedOrderId = readSavedCheckout();

        if (savedOrderId) {

          recoveredOrderId = savedOrderId;

          setActiveOrder(savedOrderId);

        } else {

          setStage('idle');

          setError(
            'No active checkout found. Check My Orders and refresh before starting a new payment.'
          );
        }
      }

    } catch (err) {

      if (!sessionValid()) return;

      setStage('idle');

      setError(
        err.response?.data?.message ||
        'Unable to recover checkout. Please try again.'
      );

    } finally {

      checkoutLock.current = false;
    }

    if (recoveredOrderId && sessionValid()) {

      await checkStatus(recoveredOrderId);
    }
  };

  // ================= CREATE NEW CHECKOUT =================

  const handleCheckout = async () => {

    if (
      loading ||
      busy ||
      checkoutLock.current ||
      blocked ||
      activeOrder ||
      paymentData ||
      !items.length ||
      !Number.isFinite(total) ||
      total <= 0
    ) return;

    if (!sessionValid()) {
      navigate('/login');
      return;
    }

    checkoutLock.current = true;

    setError('');
    setNotice('');
    setStage('order');

    try {

      // Confirm that no other checkout is active.

      const recoveryResponse =
        await getActiveCheckout(token);

      if (!sessionValid()) {
        checkoutLock.current = false;
        return;
      }

      const recovery = validateRecovery(
        recoveryResponse.data
      );

      if (recovery.active) {

        applyRecoveredOrder(recovery);

        setStage('idle');

        setError(
          'An unfinished checkout was found. Check its payment status.'
        );

        checkoutLock.current = false;

        return;
      }

      const savedOrderId = readSavedCheckout();

      if (savedOrderId) {

        setActiveOrder(savedOrderId);
        setBlocked(true);
        setStage('idle');

        setError(
          'A saved checkout requires verification.'
        );

        checkoutLock.current = false;

        return;
      }

      const response = await createRazorpayOrder(
        token,
        total
      );

      if (!sessionValid()) {
        checkoutLock.current = false;
        return;
      }

      const data = response.data;

      if (
        data.mode !== 'test' ||
        !isOrderId(data.orderId)
      ) {
        throw new Error('Invalid checkout response');
      }

      saveCheckout(data.orderId);

      setActiveOrder(data.orderId);
      setBlocked(true);

      if (Number.isSafeInteger(data.amount)) {
        setRecoveredAmount(data.amount);
      }

      if (
        data.amount !== Math.round(total * 100)
      ) {
        throw new Error('Checkout amount mismatch');
      }

      openRazorpay(data);

    } catch (err) {

      checkoutLock.current = false;

      if (!sessionValid()) return;

      setStage('idle');

      if (
        err.response?.status === 409 ||
        !err.response ||
        err.response?.status >= 500
      ) {
        setBlocked(true);
      }

      setError(
        err.response?.data?.message ||
        err.message ||
        'Unable to create checkout.'
      );
    }
  };

  // ================= RETRY EXISTING PAYMENT =================

  const retryPayment = async () => {

    if (
      !retryData ||
      !activeOrder ||
      refundInfo ||
      checkoutLock.current ||
      !sessionValid()
    ) return;

    checkoutLock.current = true;

    setStage('verify');
    setBlocked(true);
    setError('');
    setRetryData(null);

    try {

      const response = await getPaymentStatus(
        token,
        activeOrder
      );

      if (!sessionValid()) {
        checkoutLock.current = false;
        return;
      }

      const data = validateStatus(
        response.data,
        activeOrder
      );

      const refundHandled =
        await handleRefundStatus(
          activeOrder,
          data
        );

      if (refundHandled || !sessionValid()) {

        checkoutLock.current = false;

        return;
      }

      if (data.status === 'paid') {

        completeOrder(data, activeOrder);

        checkoutLock.current = false;

        return;
      }

      if (
        data.status !== 'unpaid' ||
        data.canRetry !== true
      ) {
        throw new Error(
          data.message ||
          'Payment cannot be retried safely'
        );
      }

      openRazorpay(data);

    } catch (err) {

      checkoutLock.current = false;

      if (!sessionValid()) return;

      setStage('idle');
      setBlocked(true);

      setError(
        err.response?.data?.message ||
        err.message ||
        'Unable to retry payment safely.'
      );
    }
  };

  // ================= REFUND DISPLAY =================

  const refundTitle = refundInfo
    ? {
        refunded: 'Fully Refunded',
        partially_refunded: 'Partially Refunded',
        refund_pending: 'Refund Processing'
      }[refundInfo.status]
    : '';

  // ================= SUCCESS SCREEN =================

  if (stage === 'done' && receipt) {

    return (
      <div className="sx-page">

        <motion.div
          className="sx-success"
          initial={{
            opacity: 0,
            scale: 0.94,
            y: 16
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0
          }}
          transition={{
            type: 'spring',
            stiffness: 160,
            damping: 18
          }}
        >

          <div className="sx-check">

            <svg viewBox="0 0 24 24">

              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  delay: 0.25,
                  duration: 0.5
                }}
              />

            </svg>

          </div>

          <h1>Order confirmed!</h1>

          <p>
            Your Razorpay test payment has been
            successfully verified.
          </p>

          <p>
            Test Mode — no real money has been charged.
          </p>

          <div className="sx-receipt">

            <div>
              <span>Payment amount</span>
              <span>{rupee(receipt.amount)}</span>
            </div>

            <div>
              <span>Payment gateway</span>
              <span>Razorpay</span>
            </div>

            <div>
              <span>Payment mode</span>
              <span>Test Mode</span>
            </div>

            {receipt.transactionId && (
              <div>
                <span>Transaction ID</span>
                <span>{receipt.transactionId}</span>
              </div>
            )}

          </div>

          <button
            className="sx-btn"
            onClick={() => navigate('/products')}
          >
            Continue shopping
          </button>

          <button
            className="sx-btn ghost"
            onClick={() => navigate('/orders')}
          >
            View My Orders
          </button>

        </motion.div>

      </div>
    );
  }

  // ================= CHECKOUT PAGE =================

  return (
    <div className="sx-page">

      <div className="sx-wrap">

        <div className="sx-head">

          <h1>Checkout</h1>

          <p>
            Review your order and pay securely with Razorpay.
          </p>

        </div>

        {/* ================= REFUND NOTICE ================= */}

        {notice && (
          <div
            className="sx-refund-notice"
            role="status"
          >
            {notice}
          </div>
        )}

        {loading ? (

          <div className="sx-panel">

            <div className="sx-skeleton" />
            <div className="sx-skeleton" />

            <p style={{ padding: 20 }}>
              Checking for unfinished payments...
            </p>

          </div>

        ) : items.length === 0 &&
            !activeOrder &&
            !blocked ? (

          <div className="sx-empty">

            <h2>Nothing to pay for yet</h2>

            <p>Your cart is empty.</p>

            <button
              className="sx-btn"
              onClick={() => navigate('/products')}
            >
              Browse products
            </button>

            <button
              className="sx-btn ghost"
              onClick={() => navigate('/orders')}
            >
              View My Orders
            </button>

          </div>

        ) : (

          <div className="sx-grid">

            <div style={{ display: 'grid', gap: 24 }}>

              <div className="sx-panel">

                {activeOrder && (

                  <div style={{ padding: 20 }}>

                    <h3>Previous checkout recovered</h3>

                    <p>
                      Order ID: {activeOrder}
                    </p>

                    <p>
                      Check the payment status before
                      starting another payment.
                    </p>

                    <p>
                      The recovered order may contain
                      different items from your current cart.
                    </p>

                    {recoveredAmount !== null && (
                      <p>
                        Previous order amount:{' '}

                        <strong>
                          {rupee(recoveredAmount / 100)}
                        </strong>
                      </p>
                    )}

                  </div>
                )}

                {!activeOrder && items.map((item, idx) => {

                  const src =
                    item.image ||
                    item.imageUrl ||
                    item.img;

                  return (

                    <div
                      className="sx-item"
                      key={
                        item._id ||
                        item.productId ||
                        idx
                      }
                    >

                      <div className="sx-thumb">

                        {src ? (
                          <img
                            src={src}
                            alt={item.name}
                          />
                        ) : (
                          (item.name || '?').charAt(0)
                        )}

                      </div>

                      <div>

                        <div className="sx-item-name">
                          {item.name}
                        </div>

                        <div className="sx-item-meta">

                          {rupee(item.price)}
                          {' × '}
                          {item.quantity}

                        </div>

                      </div>

                      <div className="sx-item-total">

                        {rupee(
                          item.price * item.quantity
                        )}

                      </div>

                    </div>
                  );
                })}

                {!items.length &&
                  !activeOrder &&
                  blocked && (

                    <p style={{ padding: 20 }}>
                      Checking your previous checkout.
                    </p>

                  )}

              </div>

              {/* ================= PAYMENT METHOD ================= */}

              <div className="sx-panel pad">

                <h2>Payment method</h2>

                <div className="sx-method">

                  <span className="dot" />

                  <span>

                    Razorpay

                    <small>
                      UPI, Cards and Net Banking
                    </small>

                    <small>
                      Test Mode — no real money charged
                    </small>

                  </span>

                </div>

              </div>

            </div>

            {/* ================= ORDER SUMMARY ================= */}

            <aside className="sx-panel pad sx-summary">

              <h2>
                {activeOrder
                  ? 'Recovered order total'
                  : 'Order total'}
              </h2>

              <div className="sx-line">

                <span>Subtotal</span>

                <strong>
                  {activeOrder && recoveredAmount === null
                    ? 'Pending verification'
                    : rupee(displayedTotal)}
                </strong>

              </div>

              <div className="sx-line">

                <span>Delivery</span>

                <span className="free">
                  Free
                </span>

              </div>

              <div className="sx-total">

                <span>Total</span>

                <b>
                  {activeOrder && recoveredAmount === null
                    ? 'Pending'
                    : rupee(displayedTotal)}
                </b>

              </div>

              {/* ================= REFUND INFORMATION ================= */}

              {refundInfo && (

                <div
                  className={`sx-refund-box ${
                    refundInfo.status === 'refunded'
                      ? 'success'
                      : 'pending'
                  }`}
                >

                  <h3>{refundTitle}</h3>

                  {Number.isSafeInteger(
                    refundInfo.amount
                  ) &&
                    refundInfo.amount > 0 && (

                      <p>
                        Refunded amount:{' '}

                        <strong>
                          {rupee(refundInfo.amount / 100)}
                        </strong>

                      </p>

                    )}

                  <p>

                    {refundInfo.status === 'refunded'
                      ? 'Your previous test payment has been refunded.'
                      : refundInfo.status === 'partially_refunded'
                      ? 'A partial refund was recorded. Do not retry this payment.'
                      : 'Your refund is being processed. Do not pay again.'}

                  </p>

                  <small>
                    Test Mode — no real money transferred.
                  </small>

                </div>

              )}

              {busy && (

                <div style={{ marginTop: 22 }}>

                  <Steps stage={stage} />

                </div>

              )}

              {error && (

                <div className="sx-alert" role="alert">

                  {error}

                </div>

              )}

              {/* ================= CHECK PAYMENT STATUS ================= */}

              {activeOrder && (

                <button
                  className="sx-btn"
                  onClick={() => checkStatus(activeOrder)}
                  disabled={busy}
                >

                  {busy
                    ? 'Processing...'
                    : 'Check Payment Status'}

                </button>

              )}

              {/* ================= RECOVER CHECKOUT ================= */}

              {blocked &&
                !activeOrder &&
                !paymentData && (

                  <button
                    className="sx-btn"
                    onClick={recoverCheckout}
                    disabled={busy}
                  >

                    {busy
                      ? 'Recovering...'
                      : 'Recover Previous Checkout'}

                  </button>

                )}

              {/* ================= RETRY PAYMENT ================= */}

              {retryData && !refundInfo && (

                <button
                  className="sx-btn"
                  onClick={retryPayment}
                  disabled={busy}
                >

                  Retry Payment — {rupee(
                    retryData.amount / 100
                  )}

                </button>

              )}

              {paymentData && !refundInfo && (

                <button
                  className="sx-btn ghost"
                  onClick={retryVerification}
                  disabled={busy}
                >

                  Retry Payment Verification

                </button>

              )}

              {/* ================= NEW PAYMENT ================= */}

              {!activeOrder &&
                !paymentData &&
                !blocked && (

                  <button
                    className="sx-btn"
                    onClick={handleCheckout}
                    disabled={
                      busy ||
                      loading ||
                      blocked ||
                      !Number.isFinite(total) ||
                      total <= 0
                    }
                  >

                    {busy
                      ? 'Processing...'
                      : `Pay ${rupee(total)}`}

                  </button>

                )}

              {blocked && !busy && (

                <button
                  className="sx-btn ghost"
                  onClick={() => window.location.reload()}
                >

                  Refresh Checkout

                </button>

              )}

              <button
                className="sx-btn ghost"
                onClick={() => navigate('/cart')}
                disabled={
                  busy ||
                  blocked ||
                  !!activeOrder
                }
              >

                Back to cart

              </button>

              <button
                className="sx-btn ghost"
                onClick={() => navigate('/orders')}
                disabled={busy}
              >

                View My Orders

              </button>

              <p className="sx-note">

                Secure checkout powered by Razorpay.
                Currently running in Test Mode.
                No real money will be transferred.

              </p>

            </aside>

          </div>

        )}

      </div>

    </div>
  );
}

export default Checkout;
