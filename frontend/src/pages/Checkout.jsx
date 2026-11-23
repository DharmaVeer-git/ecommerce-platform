import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { placeOrder, makePayment, getCart } from '../api';
import './CartCheckout.css';

const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// stage: idle -> order -> payment -> done
function Steps({ stage }) {
  const steps = [
    { key: 'order', label: 'Placing your order' },
    { key: 'payment', label: 'Confirming payment' },
  ];
  const order = ['order', 'payment', 'done'];
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
            <span className="mark">{state === 'done' ? '✓' : ''}</span>
            {s.label}
          </div>
        );
      })}
    </div>
  );
}

function Checkout() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    getCart(token)
      .then((res) => setItems(res.data?.items || []))
      .catch(() => setError('We could not load your cart. Refresh the page and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const busy = stage === 'order' || stage === 'payment';

  const handleCheckout = async () => {
    setError('');
    try {
      setStage('order');
      const cartRes = await getCart(token);
      const amount = cartRes.data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      await placeOrder(token);

      setStage('payment');
      const paymentRes = await makePayment({ amount, method: 'UPI' }, token);

      setReceipt({
        amount,
        message: paymentRes.data.message,
        transactionId: paymentRes.data.transactionId,
      });
      setStage('done');
    } catch (err) {
      setStage('idle');
      setError(
        err.response?.data?.message ||
          'The payment could not be completed. Nothing was charged. Please try again.'
      );
    }
  };

  /* ---------- Success ---------- */
  if (stage === 'done' && receipt) {
    return (
      <div className="sx-page">
        <motion.div
          className="sx-success"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        >
          <div className="sx-check">
            <svg viewBox="0 0 24 24">
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.25, duration: 0.5, ease: 'easeOut' }}
              />
            </svg>
          </div>
          <h1>Order confirmed</h1>
          <p>{receipt.message || 'Your payment went through.'}</p>

          <div className="sx-receipt">
            <div>
              <span>Amount paid</span>
              <span>{rupee(receipt.amount)}</span>
            </div>
            <div>
              <span>Method</span>
              <span>UPI</span>
            </div>
            {receipt.transactionId && (
              <div>
                <span>Transaction ID</span>
                <span>{receipt.transactionId}</span>
              </div>
            )}
          </div>

          <button className="sx-btn" onClick={() => navigate('/products')}>
            Continue shopping
          </button>
        </motion.div>
      </div>
    );
  }

  /* ---------- Checkout ---------- */
  return (
    <div className="sx-page">
      <div className="sx-wrap">
        <div className="sx-head">
          <h1>Checkout</h1>
          <p>Review your order and pay securely.</p>
        </div>

        {loading ? (
          <div className="sx-panel">
            <div className="sx-skeleton" />
            <div className="sx-skeleton" />
          </div>
        ) : items.length === 0 ? (
          <div className="sx-empty">
            <h2>Nothing to pay for yet</h2>
            <p>Your cart is empty. Add a product first, then come back here.</p>
            <button className="sx-btn" onClick={() => navigate('/products')}>
              Browse products
            </button>
          </div>
        ) : (
          <div className="sx-grid">
            <div style={{ display: 'grid', gap: 24 }}>
              <div className="sx-panel">
                {items.map((item, idx) => {
                  const src = item.image || item.imageUrl || item.img;
                  return (
                    <div className="sx-item" key={item._id || item.productId || idx}>
                      <div className="sx-thumb">
                        {src ? <img src={src} alt={item.name} /> : (item.name || '?').charAt(0)}
                      </div>
                      <div>
                        <div className="sx-item-name">{item.name}</div>
                        <div className="sx-item-meta">
                          {rupee(item.price)} × {item.quantity}
                        </div>
                      </div>
                      <div className="sx-item-total">{rupee(item.price * item.quantity)}</div>
                    </div>
                  );
                })}
              </div>

              <div className="sx-panel pad">
                <h2>Payment method</h2>
                <div className="sx-method" aria-label="Payment method: UPI">
                  <span className="dot" />
                  <span>
                    UPI
                    <small>Pay instantly with any UPI app</small>
                  </span>
                </div>
              </div>
            </div>

            <aside className="sx-panel pad sx-summary">
              <h2>Order total</h2>
              <div className="sx-line">
                <span>Subtotal</span>
                <strong>{rupee(total)}</strong>
              </div>
              <div className="sx-line">
                <span>Delivery</span>
                <span className="free">Free</span>
              </div>
              <div className="sx-total">
                <span>Total</span>
                <b>{rupee(total)}</b>
              </div>

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

              <button className="sx-btn" onClick={handleCheckout} disabled={busy}>
                {busy ? 'Processing…' : `Pay ${rupee(total)}`}
              </button>
              <button
                className="sx-btn ghost"
                onClick={() => navigate('/cart')}
                disabled={busy}
              >
                Back to cart
              </button>
              <p className="sx-note">Please keep this page open until payment finishes.</p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default Checkout;