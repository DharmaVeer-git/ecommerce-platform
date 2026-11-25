import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  getWishlist,
  removeFromWishlist,
  addToCart
} from '../api';

import './Wishlist.css';

export default function Wishlist() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadWishlist() {
      setLoading(true);
      setError('');

      try {
        const res = await getWishlist(token);

        if (!Array.isArray(res.data)) {
          throw new Error('Invalid wishlist response');
        }

        if (active) setItems(res.data);

      } catch (err) {
        if (!active) return;

        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }

        setError(
          err.response?.data?.message ||
          'Unable to load your wishlist.'
        );

      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) {
      loadWishlist();
    } else {
      navigate('/login', { replace: true });
    }

    return () => {
      active = false;
    };

  }, [token, navigate, retry]);

  async function removeProduct(product) {
    if (busy) return;

    setBusy(true);
    setNotice('');

    try {
      await removeFromWishlist(product._id, token);

      setItems(previous =>
        previous.filter(p => p._id !== product._id)
      );

      setNotice(`${product.name} removed from wishlist.`);

    } catch (err) {
      setNotice(
        err.response?.data?.message ||
        'Unable to remove product.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function addProduct(product) {
    if (busy) return;

    setBusy(true);
    setNotice('');

    try {
      await addToCart(
        {
          productId: product._id,
          quantity: 1
        },
        token
      );

      setNotice(`${product.name} added to your bag.`);

    } catch (err) {
      setNotice(
        err.response?.data?.message ||
        'Unable to add product to bag.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sw-page">

      <div className="sw-container">

        <header className="sw-header">

          <div>
            <small>YOUR PERSONAL COLLECTION</small>

            <h1>My Wishlist.</h1>

            <p>
              Save what you love. Shop when you're ready.
            </p>
          </div>

          <button
            className="sw-secondary"
            onClick={() => navigate('/products')}
          >
            ← Continue Shopping
          </button>

        </header>

        {notice && (
          <div className="sw-notice" role="status">
            {notice}
          </div>
        )}

        {loading ? (

          <div className="sw-empty">
            <h2>Loading your wishlist...</h2>
          </div>

        ) : error ? (

          <div className="sw-empty">
            <h2>Unable to load wishlist</h2>
            <p>{error}</p>

            <button
              className="sw-primary"
              onClick={() => setRetry(x => x + 1)}
            >
              Try Again
            </button>
          </div>

        ) : items.length === 0 ? (

          <div className="sw-empty">

            <div className="sw-heart">♡</div>

            <h2>Your wishlist is empty</h2>

            <p>
              Save your favourite products by tapping
              the heart icon while shopping.
            </p>

            <button
              className="sw-primary"
              onClick={() => navigate('/products')}
            >
              Explore Products
            </button>

          </div>

        ) : (

          <>

            <div className="sw-summary">
              ♥ {items.length} saved products
            </div>

            <div className="sw-grid">

              {items.map(product => (

                <article
                  className="sw-card"
                  key={product._id}
                >

                  <div className="sw-photo">

                    {product.image ? (

                      <img
                        src={product.image}
                        alt={product.name}
                        onError={event => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />

                    ) : (

                      <span>
                        {product.name?.charAt(0)}
                      </span>

                    )}

                    <button
                      className="sw-remove-heart"
                      disabled={busy}
                      aria-label={`Remove ${product.name}`}
                      onClick={() => removeProduct(product)}
                    >
                      ♥
                    </button>

                  </div>

                  <div className="sw-copy">

                    <small>
                      {product.category || 'ShopEasy'}
                    </small>

                    <h2>{product.name}</h2>

                    <p>{product.description}</p>

                    <strong className="sw-price">
                      ₹{Number(product.price || 0)
                        .toLocaleString('en-IN')}
                    </strong>

                    <span
                      className={
                        Number(product.stock) > 0
                          ? 'sw-in-stock'
                          : 'sw-out-stock'
                      }
                    >
                      {Number(product.stock) > 0
                        ? '✓ In stock'
                        : 'Out of stock'}
                    </span>

                    <button
                      className="sw-primary"
                      disabled={
                        busy || !(Number(product.stock) > 0)
                      }
                      onClick={() => addProduct(product)}
                    >
                      Add to Bag +
                    </button>

                    <button
                      className="sw-secondary"
                      disabled={busy}
                      onClick={() => removeProduct(product)}
                    >
                      Remove from Wishlist
                    </button>

                  </div>

                </article>

              ))}

            </div>

          </>

        )}

        <footer className="sw-footer">
          © {new Date().getFullYear()} ShopEasy.
          Premium Shopping Experience.
        </footer>

      </div>

    </main>
  );
}