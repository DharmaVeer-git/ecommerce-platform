import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCart } from '../api';
import './CartCheckout.css';

const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function Thumb({ item }) {
  const src = item.image || item.imageUrl || item.img;
  return (
    <div className="sx-thumb">
      {src ? <img src={src} alt={item.name} /> : (item.name || '?').charAt(0)}
    </div>
  );
}

function Cart() {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    getCart(token)
      .then((res) => setCart(res.data || { items: [] }))
      .catch(() => setError('We could not load your cart. Check your connection and refresh the page.'))
      .finally(() => setLoading(false));
  }, []);

  const items = cart.items || [];
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="sx-page">
      <div className="sx-wrap">
        <div className="sx-head">
          <h1>Your cart</h1>
          {!loading && items.length > 0 && (
            <p>
              {count} {count === 1 ? 'item' : 'items'} ready to order
            </p>
          )}
        </div>

        {loading ? (
          <div className="sx-panel">
            <div className="sx-skeleton" />
            <div className="sx-skeleton" />
          </div>
        ) : error ? (
          <div className="sx-empty">
            <h2>Cart unavailable</h2>
            <p>{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="sx-empty">
            <h2>Your cart is empty</h2>
            <p>Pick something from the collection and spin it around in 3D first.</p>
            <button className="sx-btn" onClick={() => navigate('/products')}>
              Browse products
            </button>
          </div>
        ) : (
          <div className="sx-grid">
            <div className="sx-panel">
              {items.map((item, idx) => (
                <div className="sx-item" key={item._id || item.productId || idx}>
                  <Thumb item={item} />
                  <div>
                    <div className="sx-item-name">{item.name}</div>
                    <div className="sx-item-meta">{rupee(item.price)} each</div>
                    <span className="sx-qty">Qty {item.quantity}</span>
                  </div>
                  <div className="sx-item-total">{rupee(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>

            <aside className="sx-panel pad sx-summary">
              <h2>Order summary</h2>
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
              <button className="sx-btn" onClick={() => navigate('/checkout')}>
                Continue to checkout
              </button>
              <button className="sx-btn ghost" onClick={() => navigate('/products')}>
                Keep shopping
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

export default Cart;