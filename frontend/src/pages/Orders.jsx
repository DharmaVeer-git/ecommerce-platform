
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getOrders } from '../api';

import './Orders.css';

// ================= FORMAT HELPERS =================

const rupee = (amount) =>
  Number(amount || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR'
  });

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'Not available';

// ================= PAYMENT HELPERS =================

function isDemoOrder(order) {
  return (
    order.paymentMode === 'demo' ||
    order.status === 'demo_paid' ||
    order.paymentMethod === 'DEMO_UPI' ||
    String(order.transactionId || '').startsWith('DEMO-')
  );
}

function isTestOrder(order) {
  return (
    order.paymentMode === 'test' ||
    order.status === 'test_paid'
  );
}

function isLiveOrder(order) {
  return (
    !isDemoOrder(order) &&
    !isTestOrder(order) &&
    order.paymentMode === 'live'
  );
}

function getPaymentMode(order) {
  if (isDemoOrder(order)) return 'Demo Mode';
  if (isTestOrder(order)) return 'Test Mode';
  if (isLiveOrder(order)) return 'Live Mode';

  return 'Not available';
}

function getPaymentMethod(order) {
  if (isDemoOrder(order)) return 'Demo UPI';

  const method = String(
    order.paymentMethod || ''
  ).toLowerCase();

  const methods = {
    upi: 'UPI',
    card: 'Debit / Credit Card',
    netbanking: 'Net Banking',
    wallet: 'Wallet',
    razorpay: 'Razorpay',
    razorpay_upi: 'UPI',
    razorpay_card: 'Debit / Credit Card',
    razorpay_netbanking: 'Net Banking',
    razorpay_wallet: 'Wallet'
  };

  return (
    methods[method] ||
    order.paymentMethod ||
    'Not available'
  );
}

// ================= REFUND HELPERS =================

function getOriginalAmount(order) {
  if (
    Number.isSafeInteger(order.amountPaise) &&
    order.amountPaise > 0
  ) {
    return order.amountPaise / 100;
  }

  return Number(order.totalAmount || 0);
}

function getRefundAmount(order) {
  const amount = order.refundedAmountPaise;

  if (
    Number.isSafeInteger(amount) &&
    amount >= 0 &&
    amount <= Math.round(getOriginalAmount(order) * 100)
  ) {
    return amount / 100;
  }

  return null;
}

function getRefundState(order) {
  if (
    order.status === 'refunded' ||
    order.paymentStatus === 'refunded' ||
    order.refundStatus === 'refunded'
  ) {
    return 'refunded';
  }

  if (
    order.refundStatus === 'partial' ||
    Number(order.refundedAmountPaise || 0) > 0
  ) {
    return 'partial';
  }

  if (order.refundStatus === 'pending') {
    return 'pending';
  }

  if (order.refundStatus === 'failed') {
    return 'failed';
  }

  return 'none';
}

function getRefundStatus(order) {
  switch (getRefundState(order)) {
    case 'refunded':
      return {
        label: 'Fully Refunded',
        type: 'success'
      };

    case 'partial':
      return {
        label: 'Partially Refunded',
        type: 'pending'
      };

    case 'pending':
      return {
        label: 'Refund Processing',
        type: 'pending'
      };

    case 'failed':
      return {
        label: 'Refund Failed',
        type: 'failed'
      };

    default:
      return {
        label: 'No Refund',
        type: 'pending'
      };
  }
}

function hasCapturedPayment(order) {
  return (
    order.paymentStatus === 'captured' ||
    order.paymentStatus === 'refunded' ||
    getRefundState(order) === 'refunded' ||
    getRefundState(order) === 'partial' ||
    (
      order.status === 'test_paid' &&
      order.inventoryUpdated === true
    )
  );
}

function getNetPayment(order) {
  if (!hasCapturedPayment(order)) {
    return null;
  }

  const refundAmount = getRefundAmount(order);
  const refundState = getRefundState(order);

  if (refundState === 'refunded') {
    return 0;
  }

  if (
    refundState === 'partial' &&
    (refundAmount === null || refundAmount === 0)
  ) {
    return null;
  }

  return Math.max(
    0,
    getOriginalAmount(order) - (refundAmount || 0)
  );
}

function getRefundMessage(order) {
  const isTest = isTestOrder(order);

  switch (getRefundState(order)) {
    case 'refunded':
      return isTest
        ? 'The full test payment has been refunded. No real money was transferred.'
        : 'The full payment has been marked as refunded by the payment gateway.';

    case 'partial':
      return isTest
        ? 'A portion of this test payment has been refunded.'
        : 'A portion of your payment has been refunded.';

    case 'pending':
      return 'Your refund is currently being processed by the payment gateway.';

    case 'failed':
      return 'A refund attempt failed. Please contact customer support for assistance.';

    default:
      return '';
  }
}

// ================= ORDER STATUS HELPERS =================

function getStatus(status) {
  switch (status) {
    case 'demo_paid':
      return {
        label: 'Demo Payment Successful',
        type: 'success'
      };

    case 'test_paid':
      return {
        label: 'Test Payment Successful',
        type: 'success'
      };

    case 'paid':
      return {
        label: 'Payment Successful',
        type: 'success'
      };

    case 'delivered':
      return {
        label: 'Delivered',
        type: 'success'
      };

    case 'shipped':
      return {
        label: 'Shipped',
        type: 'pending'
      };

    case 'pending':
      return {
        label: 'Payment Pending',
        type: 'pending'
      };

    case 'authorized':
      return {
        label: 'Payment Authorized',
        type: 'pending'
      };

    case 'payment_review':
      return {
        label: 'Payment Under Review',
        type: 'pending'
      };

    case 'cancelled':
      return {
        label: 'Cancelled',
        type: 'failed'
      };

    case 'failed':
      return {
        label: 'Payment Failed',
        type: 'failed'
      };

    case 'refunded':
      return {
        label: 'Fully Refunded',
        type: 'success'
      };

    case 'refund_partial':
      return {
        label: 'Partially Refunded',
        type: 'pending'
      };

    case 'refund_pending':
      return {
        label: 'Refund Processing',
        type: 'pending'
      };

    case 'refund_failed':
      return {
        label: 'Refund Failed',
        type: 'failed'
      };

    default:
      return {
        label: status || 'Pending',
        type: 'pending'
      };
  }
}

function getDisplayStatus(order) {
  const refundState = getRefundState(order);

  if (refundState === 'refunded') {
    return 'refunded';
  }

  if (refundState === 'partial') {
    return 'refund_partial';
  }

  if (refundState === 'pending') {
    return 'refund_pending';
  }

  if (refundState === 'failed') {
    return 'refund_failed';
  }

  return order.status || 'pending';
}

function getPaymentStatus(order) {
  const refundState = getRefundState(order);

  if (refundState === 'refunded') {
    return 'Fully Refunded';
  }

  if (refundState === 'partial') {
    return 'Partially Refunded';
  }

  if (order.paymentStatus === 'captured') {
    return 'Captured';
  }

  if (order.paymentStatus === 'authorized') {
    return 'Authorized';
  }

  if (order.paymentStatus === 'failed') {
    return 'Failed';
  }

  if (order.paymentStatus === 'pending') {
    return 'Pending';
  }

  if (order.status === 'demo_paid') {
    return 'Simulated Success';
  }

  return 'Not available';
}

// ================= ORDERS COMPONENT =================

export default function Orders() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');

  const [expanded, setExpanded] = useState(null);
  const [reload, setReload] = useState(0);

  // ================= FETCH ORDERS =================

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      setLoading(true);
      setError('');
      setOrders([]);

      try {
        const res = await getOrders(token);

        if (
          !active ||
          localStorage.getItem('token') !== token
        ) return;

        const data = Array.isArray(res.data)
          ? res.data
          : res.data?.orders;

        if (!Array.isArray(data)) {
          throw new Error('Invalid order response.');
        }

        setOrders(data);

      } catch (err) {
        if (
          !active ||
          localStorage.getItem('token') !== token
        ) return;

        if (err.response?.status === 401) {
          localStorage.removeItem('token');

          navigate('/login', { replace: true });
          return;
        }

        setError(
          err.response?.data?.message ||
          'Unable to load your orders. Please try again.'
        );

      } finally {
        if (
          active &&
          localStorage.getItem('token') === token
        ) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      active = false;
    };

  }, [token, navigate, reload]);

  // ================= ORDER STATISTICS =================

  const testOrders = orders.filter(order =>
    isTestOrder(order) &&
    order.status === 'test_paid' &&
    getRefundState(order) !== 'refunded'
  );

  const demoOrders = orders.filter(order =>
    isDemoOrder(order) &&
    order.status === 'demo_paid'
  );

  const liveOrders = orders.filter(order =>
    isLiveOrder(order) &&
    order.paymentStatus === 'captured' &&
    getRefundState(order) !== 'refunded'
  );

  const testPaymentOrders = orders.filter(order =>
    isTestOrder(order) &&
    hasCapturedPayment(order)
  );

  const livePaymentOrders = orders.filter(order =>
    isLiveOrder(order) &&
    hasCapturedPayment(order)
  );

  const fullyRefundedOrders = orders.filter(order =>
    getRefundState(order) === 'refunded'
  );

  const partiallyRefundedOrders = orders.filter(order =>
    getRefundState(order) === 'partial'
  );

  const pendingRefundOrders = orders.filter(order =>
    getRefundState(order) === 'pending'
  );

  const failedRefundOrders = orders.filter(order =>
    getRefundState(order) === 'failed'
  );

  const testRefundOrders = orders.filter(order =>
    isTestOrder(order) &&
    ['partial', 'refunded'].includes(
      getRefundState(order)
    )
  );

  const liveRefundOrders = orders.filter(order =>
    isLiveOrder(order) &&
    ['partial', 'refunded'].includes(
      getRefundState(order)
    )
  );

  const sumNetPayments = (list) => {
    const amounts = list.map(getNetPayment);

    if (amounts.some(amount => amount === null)) {
      return null;
    }

    return amounts.reduce(
      (sum, amount) => sum + amount,
      0
    );
  };

  const sumRefunds = (list) => {
    const amounts = list.map(getRefundAmount);

    if (
      amounts.some(
        amount => amount === null || amount === 0
      )
    ) {
      return null;
    }

    return amounts.reduce(
      (sum, amount) => sum + amount,
      0
    );
  };

  const testTotal = sumNetPayments(testPaymentOrders);

  const liveTotal = sumNetPayments(livePaymentOrders);

  const testRefundTotal = sumRefunds(testRefundOrders);

  const liveRefundTotal = sumRefunds(liveRefundOrders);

  const demoTotal = demoOrders.reduce(
    (sum, order) =>
      sum + Number(order.totalAmount || 0),
    0
  );

  const displayAmount = (amount) =>
    amount === null
      ? 'Requires review'
      : rupee(amount);

  // ================= SEARCH AND FILTER =================

  const query = search.trim().toLowerCase();

  const filteredOrders = orders
    .filter(order => {

      const matchesFilter =
        filter === 'all' ||
        getDisplayStatus(order) === filter;

      const matchesSearch =
        !query ||
        String(order._id || '')
          .toLowerCase()
          .includes(query) ||
        String(order.transactionId || '')
          .toLowerCase()
          .includes(query) ||
        String(order.razorpayPaymentId || '')
          .toLowerCase()
          .includes(query) ||
        String(order.razorpayOrderId || '')
          .toLowerCase()
          .includes(query) ||
        getRefundStatus(order)
          .label
          .toLowerCase()
          .includes(query) ||
        (order.items || []).some(item =>
          String(item.name || '')
            .toLowerCase()
            .includes(query)
        );

      return matchesFilter && matchesSearch;

    })
    .sort((a, b) => {
      if (sort === 'highest') {
        return getOriginalAmount(b) -
          getOriginalAmount(a);
      }

      if (sort === 'lowest') {
        return getOriginalAmount(a) -
          getOriginalAmount(b);
      }

      if (sort === 'oldest') {
        return new Date(a.createdAt) -
          new Date(b.createdAt);
      }

      return new Date(b.createdAt) -
        new Date(a.createdAt);
    });

  const availableStatuses = [
    ...new Set(
      orders.map(getDisplayStatus).filter(Boolean)
    )
  ];

  // ================= PAGE INTERFACE =================

  return (
    <main className="so-page">
      <div className="so-container">

        {/* ================= HEADER ================= */}

        <header className="so-header">
          <div>
            <span className="so-kicker">
              YOUR SHOPPING HISTORY
            </span>

            <h1>My Orders.</h1>

            <p>
              View your purchases, payment status,
              refunds and order information.
            </p>
          </div>

          <button
            className="so-secondary"
            onClick={() => navigate('/products')}
          >
            ← Continue Shopping
          </button>
        </header>

        {loading ? (
          <div className="so-empty">
            <div className="so-spinner" />

            <h2>Loading your orders...</h2>

            <p>
              Retrieving your shopping history.
            </p>
          </div>

        ) : error ? (
          <div className="so-empty">
            <h2>Unable to load orders</h2>

            <p role="alert">{error}</p>

            <button
              className="so-primary"
              onClick={() =>
                setReload(previous => previous + 1)
              }
            >
              Try Again
            </button>
          </div>

        ) : (
          <>

            {/* ================= STATISTICS ================= */}

            <div className="so-stats">

              <div className="so-stat">
                <span>📦 Total Orders</span>

                <strong>{orders.length}</strong>

                <small>Your order history</small>
              </div>

              <div className="so-stat">
                <span>✓ Successful Test Orders</span>

                <strong className="so-success-text">
                  {testOrders.length}
                </strong>

                <small>
                  Excludes fully refunded orders
                </small>
              </div>

              <div className="so-stat">
                <span>₹ Net Test Payments</span>

                <strong>
                  {displayAmount(testTotal)}
                </strong>

                <small>
                  After processed refunds · No real money
                </small>
              </div>

              {fullyRefundedOrders.length > 0 && (
                <div className="so-stat">
                  <span>↩ Fully Refunded</span>

                  <strong className="so-success-text">
                    {fullyRefundedOrders.length}
                  </strong>

                  <small>
                    Fully refunded orders
                  </small>
                </div>
              )}

              {partiallyRefundedOrders.length > 0 && (
                <div className="so-stat">
                  <span>Partial Refunds</span>

                  <strong>
                    {partiallyRefundedOrders.length}
                  </strong>

                  <small>
                    Orders with partial refunds
                  </small>
                </div>
              )}

              {pendingRefundOrders.length > 0 && (
                <div className="so-stat">
                  <span>Refund Processing</span>

                  <strong>
                    {pendingRefundOrders.length}
                  </strong>

                  <small>
                    Orders awaiting refund completion
                  </small>
                </div>
              )}

              {failedRefundOrders.length > 0 && (
                <div className="so-stat">
                  <span>Failed Refunds</span>

                  <strong>
                    {failedRefundOrders.length}
                  </strong>

                  <small>
                    Orders requiring assistance
                  </small>
                </div>
              )}

              {testRefundOrders.length > 0 && (
                <div className="so-stat">
                  <span>₹ Test Refund Total</span>

                  <strong className="so-success-text">
                    {displayAmount(testRefundTotal)}
                  </strong>

                  <small>
                    Processed test refunds only
                  </small>
                </div>
              )}

              {demoOrders.length > 0 && (
                <>
                  <div className="so-stat">
                    <span>Successful Demo Orders</span>

                    <strong>{demoOrders.length}</strong>

                    <small>Legacy simulated orders</small>
                  </div>

                  <div className="so-stat">
                    <span>Demo Order Value</span>

                    <strong>{rupee(demoTotal)}</strong>

                    <small>No real money charged</small>
                  </div>
                </>
              )}

              {livePaymentOrders.length > 0 && (
                <>
                  <div className="so-stat">
                    <span>Captured Live Orders</span>

                    <strong>{liveOrders.length}</strong>

                    <small>
                      Excludes fully refunded orders
                    </small>
                  </div>

                  <div className="so-stat">
                    <span>Net Live Payments</span>

                    <strong>
                      {displayAmount(liveTotal)}
                    </strong>

                    <small>
                      After processed refunds
                    </small>
                  </div>
                </>
              )}

              {liveRefundOrders.length > 0 && (
                <div className="so-stat">
                  <span>₹ Live Refund Total</span>

                  <strong className="so-success-text">
                    {displayAmount(liveRefundTotal)}
                  </strong>

                  <small>
                    Processed live refunds only
                  </small>
                </div>
              )}

            </div>

            {/* ================= SEARCH AND FILTERS ================= */}

            <div className="so-toolbar">

              <input
                type="search"
                aria-label="Search orders"
                placeholder="Search products, order ID, transaction ID..."
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
              />

              <select
                aria-label="Filter order status"
                value={filter}
                onChange={event =>
                  setFilter(event.target.value)
                }
              >
                <option value="all">
                  All Orders
                </option>

                {availableStatuses.map(status => (
                  <option key={status} value={status}>
                    {getStatus(status).label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Sort orders"
                value={sort}
                onChange={event =>
                  setSort(event.target.value)
                }
              >
                <option value="newest">
                  Newest First
                </option>

                <option value="oldest">
                  Oldest First
                </option>

                <option value="highest">
                  Highest Amount
                </option>

                <option value="lowest">
                  Lowest Amount
                </option>
              </select>

              <button
                className="so-secondary"
                onClick={() => {
                  setFilter('all');
                  setReload(previous => previous + 1);
                }}
              >
                ↻ Refresh Orders
              </button>

            </div>

            {/* ================= EMPTY STATE ================= */}

            {filteredOrders.length === 0 ? (
              <div className="so-empty">

                <div className="so-empty-icon">
                  📦
                </div>

                <h2>
                  {orders.length === 0
                    ? 'No orders yet'
                    : 'No matching orders'}
                </h2>

                <p>
                  {orders.length === 0
                    ? 'Your purchases will appear here after checkout.'
                    : 'Try changing your search or filters.'}
                </p>

                <button
                  className="so-primary"
                  onClick={() => {
                    if (orders.length === 0) {
                      navigate('/products');
                    } else {
                      setSearch('');
                      setFilter('all');
                    }
                  }}
                >
                  {orders.length === 0
                    ? 'Start Shopping'
                    : 'Clear Filters'}
                </button>

              </div>

            ) : (
              <div className="so-list">

                <p className="so-count">
                  Showing {filteredOrders.length} of{' '}
                  {orders.length} orders
                </p>

                {filteredOrders.map(order => {

                  const status = getStatus(
                    getDisplayStatus(order)
                  );

                  const refundState =
                    getRefundState(order);

                  const refundStatus =
                    getRefundStatus(order);

                  const refundAmount =
                    getRefundAmount(order);

                  const originalAmount =
                    getOriginalAmount(order);

                  const netAmount =
                    getNetPayment(order);

                  const hasRefund =
                    refundState !== 'none';

                  const isExpanded =
                    expanded === order._id;

                  const isDemo = isDemoOrder(order);

                  const isTest = isTestOrder(order);

                  const isRazorpay = Boolean(
                    order.razorpayOrderId ||
                    order.razorpayPaymentId
                  );

                  const refundAmountLabel =
                    ['partial', 'refunded'].includes(
                      refundState
                    ) &&
                    (refundAmount === null ||
                      refundAmount === 0)
                      ? 'Requires review'
                      : displayAmount(refundAmount);

                  return (
                    <article
                      className="so-card"
                      key={order._id}
                    >

                      {/* ================= ORDER HEADER ================= */}

                      <div className="so-card-header">

                        <div>
                          <small>ORDER PLACED</small>

                          <strong>
                            {formatDate(order.createdAt)}
                          </strong>
                        </div>

                        <div>
                          <small>ORDER TOTAL</small>

                          <strong>
                            {rupee(originalAmount)}
                          </strong>
                        </div>

                        <div>
                          <small>ORDER ID</small>

                          <strong className="so-id">
                            #{String(order._id || '')
                              .slice(-8)
                              .toUpperCase()}
                          </strong>
                        </div>

                        <span
                          className={`so-status ${status.type}`}
                        >
                          {status.label}
                        </span>

                      </div>

                      {/* ================= PAYMENT INFORMATION ================= */}

                      <div className="so-payment-strip">

                        <span>
                          {isRazorpay
                            ? 'Razorpay'
                            : isDemo
                            ? 'Demo Payment'
                            : 'Payment'}
                        </span>

                        <span className="so-payment-mode">
                          {getPaymentMode(order)}
                        </span>

                        {order.paymentStatus === 'captured' &&
                          refundState !== 'refunded' && (
                            <span className="so-success-text">
                              ✓ Payment Captured
                            </span>
                          )}

                        {refundState === 'refunded' && (
                          <span className="so-success-text">
                            ✓ Refund Processed
                          </span>
                        )}

                        {refundState === 'partial' && (
                          <span>
                            Partial Refund
                          </span>
                        )}

                        {refundState === 'pending' && (
                          <span>
                            Refund Processing
                          </span>
                        )}

                        {refundState === 'failed' && (
                          <span>
                            Refund Failed
                          </span>
                        )}

                      </div>

                      {/* ================= REFUND INFORMATION ================= */}

                      {hasRefund && (
                        <div
                          className={`so-refund-panel ${refundStatus.type}`}
                        >

                          <div className="so-refund-heading">

                            <h3>
                              ↩ Refund Information
                            </h3>

                            <span
                              className={`so-status ${refundStatus.type}`}
                            >
                              {refundStatus.label}
                            </span>

                          </div>

                          <p>
                            {getRefundMessage(order)}
                          </p>

                          <div className="so-refund-grid">

                            <div className="so-refund-value">
                              <small>
                                Original Order Amount
                              </small>

                              <strong>
                                {rupee(originalAmount)}
                              </strong>
                            </div>

                            <div className="so-refund-value">
                              <small>
                                Processed Refund
                              </small>

                              <strong className="so-success-text">
                                {refundAmountLabel}
                              </strong>
                            </div>

                            <div className="so-refund-value">
                              <small>
                                Net Payment
                              </small>

                              <strong>
                                {displayAmount(netAmount)}
                              </strong>
                            </div>

                          </div>

                          {order.lastRefundAt && (
                            <small className="so-refund-date">
                              Last processed refund:{' '}
                              {formatDate(order.lastRefundAt)}
                            </small>
                          )}

                          {isTest && (
                            <p className="so-demo-note">
                              This is a Razorpay Test Mode
                              refund. No real money was
                              transferred.
                            </p>
                          )}

                        </div>
                      )}

                      {/* ================= ORDER PRODUCTS ================= */}

                      <div className="so-items">

                        {(order.items || []).map(
                          (item, index) => (
                            <div
                              className="so-item"
                              key={item._id || index}
                            >

                              <div className="so-product-icon">
                                {(item.name || '?')
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="so-product-info">

                                <h3>
                                  {item.name || 'Product'}
                                </h3>

                                <p>
                                  Quantity: {item.quantity}
                                </p>

                                <span>
                                  {rupee(item.price)} each
                                </span>

                              </div>

                              <strong>
                                {rupee(
                                  item.price * item.quantity
                                )}
                              </strong>

                            </div>
                          )
                        )}

                      </div>

                      {/* ================= ORDER ACTIONS ================= */}

                      <div className="so-card-actions">

                        <button
                          className="so-secondary"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpanded(
                              isExpanded
                                ? null
                                : order._id
                            )
                          }
                        >
                          {isExpanded
                            ? 'Hide Order Details ↑'
                            : 'View Order Details ↓'}
                        </button>

                        <button
                          className="so-primary"
                          onClick={() =>
                            navigate('/products')
                          }
                        >
                          Shop Again
                        </button>

                      </div>

                      {/* ================= EXPANDED ORDER DETAILS ================= */}

                      {isExpanded && (
                        <div className="so-details">

                          <h3>
                            Order & Payment Information
                          </h3>

                          <div className="so-detail">
                            <span>Full Order ID</span>

                            <strong>
                              {order._id}
                            </strong>
                          </div>

                          <div className="so-detail">
                            <span>Transaction ID</span>

                            <strong>
                              {order.razorpayPaymentId ||
                                order.transactionId ||
                                'Not available'}
                            </strong>
                          </div>

                          {order.razorpayOrderId && (
                            <div className="so-detail">
                              <span>Razorpay Order ID</span>

                              <strong>
                                {order.razorpayOrderId}
                              </strong>
                            </div>
                          )}

                          <div className="so-detail">
                            <span>Payment Gateway</span>

                            <strong>
                              {isRazorpay
                                ? 'Razorpay'
                                : isDemo
                                ? 'Demo Gateway'
                                : 'Not available'}
                            </strong>
                          </div>

                          <div className="so-detail">
                            <span>Payment Method</span>

                            <strong>
                              {getPaymentMethod(order)}
                            </strong>
                          </div>

                          <div className="so-detail">
                            <span>Payment Mode</span>

                            <strong>
                              {getPaymentMode(order)}
                            </strong>
                          </div>

                          <div className="so-detail">
                            <span>Payment Status</span>

                            <strong>
                              {getPaymentStatus(order)}
                            </strong>
                          </div>

                          <div className="so-detail">
                            <span>Order Status</span>

                            <strong>
                              {getStatus(order.status).label}
                            </strong>
                          </div>

                          <div className="so-detail">
                            <span>Order Date</span>

                            <strong>
                              {formatDate(order.createdAt)}
                            </strong>
                          </div>

                          {order.paidAt && (
                            <div className="so-detail">
                              <span>Payment Date</span>

                              <strong>
                                {formatDate(order.paidAt)}
                              </strong>
                            </div>
                          )}

                          <div className="so-detail">
                            <span>Original Order Amount</span>

                            <strong>
                              {rupee(originalAmount)}
                            </strong>
                          </div>

                          {/* ================= REFUND DETAILS ================= */}

                          {hasRefund && (
                            <>

                              <div className="so-detail">
                                <span>Refund Status</span>

                                <strong>
                                  {refundStatus.label}
                                </strong>
                              </div>

                              <div className="so-detail">
                                <span>Refunded Amount</span>

                                <strong className="so-success-text">
                                  {refundAmountLabel}
                                </strong>
                              </div>

                              <div className="so-detail">
                                <span>Net Payment Amount</span>

                                <strong>
                                  {displayAmount(netAmount)}
                                </strong>
                              </div>

                              {order.lastRefundAt && (
                                <div className="so-detail">
                                  <span>Last Refund Date</span>

                                  <strong>
                                    {formatDate(
                                      order.lastRefundAt
                                    )}
                                  </strong>
                                </div>
                              )}

                            </>
                          )}

                          {isTest && (
                            <p className="so-demo-note">
                              This order was placed using
                              Razorpay Test Mode.
                              No real money was charged.
                            </p>
                          )}

                          {isDemo && (
                            <p className="so-demo-note">
                              This is a demonstration order.
                              No real money was charged.
                            </p>
                          )}

                        </div>
                      )}

                    </article>
                  );
                })}

              </div>
            )}

          </>
        )}

        {/* ================= FOOTER ================= */}

        <footer className="so-footer">
          © {new Date().getFullYear()} ShopEasy.
          Premium Shopping Experience.
        </footer>

      </div>
    </main>
  );
}
