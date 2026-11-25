import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { placeOrder, getCart } from '../api';
import './CartCheckout.css';

const rupee = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN')}`;

// ================= CHECKOUT STEPS =================

function Steps({ stage }) {
  const steps = [
    {
      key: 'order',
      label: 'Placing your order'
    },
    {
      key: 'payment',
      label: 'Processing demo payment'
    }
  ];

  const order = ['order', 'payment', 'done'];

  return (
    <div
      className="sx-steps"
      role="status"
      aria-live="polite"
    >
      {steps.map((s) => {
        const state =
          order.indexOf(stage) > order.indexOf(s.key)
            ? 'done'
            : stage === s.key
            ? 'active'
            : '';

        return (
          <div
            key={s.key}
            className={`sx-step ${state}`}
          >
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

// ================= CHECKOUT COMPONENT =================

function Checkout() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const checkoutLock = useRef(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // ================= LOAD CART =================

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    getCart(token)
      .then((res) => {
        setItems(res.data?.items || []);
      })
      .catch(() => {
        setError(
          'We could not load your cart. Refresh the page and try again.'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, navigate]);

  // ================= ORDER TOTAL =================

  const total = items.reduce(
    (sum, item) =>
      sum + item.price * item.quantity,
    0
  );

  const busy =
    stage === 'order' ||
    stage === 'payment';

  // ================= DEMO CHECKOUT =================

  const handleCheckout = async () => {
    if (
      busy ||
      checkoutLock.current ||
      items.length === 0
    ) {
      return;
    }

    if (!token) {
      navigate('/login');
      return;
    }

    checkoutLock.current = true;

    setError('');

    try {
      setStage('order');

      setStage('payment');

      // Backend validates product prices,
      // availability and stock before completing
      // the simulated payment.

      const orderRes = await placeOrder(
        token,
        total
      );

      setReceipt({
        amount: orderRes.data.amount,
        message: orderRes.data.message,
        transactionId:
          orderRes.data.transactionId
      });

      setItems([]);
      setStage('done');

    } catch (err) {
      setStage('idle');

      setError(
        err.response?.data?.message ||
        'Unable to confirm your demo order. Refresh your cart before trying again.'
      );

    } finally {
      checkoutLock.current = false;
    }
  };

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
                initial={{
                  pathLength: 0
                }}
                animate={{
                  pathLength: 1
                }}
                transition={{
                  delay: 0.25,
                  duration: 0.5,
                  ease: 'easeOut'
                }}
              />

            </svg>

          </div>

          <h1>Demo order confirmed</h1>

          <p>
            {receipt.message ||
              'Your simulated payment was successful.'}
          </p>

          <p>
            No real money has been charged.
          </p>

          <div className="sx-receipt">

            <div>
              <span>Demo payment amount</span>
              <span>
                {rupee(receipt.amount)}
              </span>
            </div>

            <div>
              <span>Method</span>
              <span>Demo UPI</span>
            </div>

            {receipt.transactionId && (
              <div>
                <span>Transaction ID</span>

                <span>
                  {receipt.transactionId}
                </span>
              </div>
            )}

          </div>

          <button
            className="sx-btn"
            onClick={() =>
              navigate('/products')
            }
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
            Review your order and try our demo checkout.
          </p>

        </div>

        {loading ? (

          <div className="sx-panel">

            <div className="sx-skeleton" />

            <div className="sx-skeleton" />

          </div>

        ) : items.length === 0 ? (

          <div className="sx-empty">

            <h2>
              {error
                ? 'Unable to load cart'
                : 'Nothing to pay for yet'}
            </h2>

            <p>
              {error ||
                'Your cart is empty. Add a product first, then come back here.'}
            </p>

            <button
              className="sx-btn"
              onClick={() =>
                navigate('/products')
              }
            >
              Browse products
            </button>

          </div>

        ) : (

          <div className="sx-grid">

            <div
              style={{
                display: 'grid',
                gap: 24
              }}
            >

              {/* ================= CART ITEMS ================= */}

              <div className="sx-panel">

                {items.map((item, idx) => {

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
                          item.price *
                          item.quantity
                        )}

                      </div>

                    </div>
                  );
                })}

              </div>

              {/* ================= PAYMENT METHOD ================= */}

              <div className="sx-panel pad">

                <h2>Payment method</h2>

                <div
                  className="sx-method"
                  aria-label="Payment method: Demo UPI"
                >

                  <span className="dot" />

                  <span>

                    Demo UPI

                    <small>
                      Simulated payment — no real money charged
                    </small>

                  </span>

                </div>

              </div>

            </div>

            {/* ================= ORDER SUMMARY ================= */}

            <aside className="sx-panel pad sx-summary">

              <h2>Order total</h2>

              <div className="sx-line">

                <span>Subtotal</span>

                <strong>
                  {rupee(total)}
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

                <b>{rupee(total)}</b>

              </div>

              {/* ================= PROCESSING ================= */}

              {busy && (

                <div
                  style={{
                    marginTop: 22
                  }}
                >

                  <Steps stage={stage} />

                </div>

              )}

              {/* ================= ERROR MESSAGE ================= */}

              {error && (

                <div
                  className="sx-alert"
                  role="alert"
                >

                  {error}

                </div>

              )}

              {/* ================= PAYMENT BUTTON ================= */}

              <button
                className="sx-btn"
                onClick={handleCheckout}
                disabled={busy || total <= 0}
              >

                {busy
                  ? 'Processing...'
                  : `Demo Pay ${rupee(total)}`}

              </button>

              <button
                className="sx-btn ghost"
                onClick={() =>
                  navigate('/cart')
                }
                disabled={busy}
              >

                Back to cart

              </button>

              <p className="sx-note">

                This is a demonstration checkout.
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