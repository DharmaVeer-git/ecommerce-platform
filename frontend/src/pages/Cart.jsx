import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCart } from '../api';

function Cart() {
  const [cart, setCart] = useState({ items: [] });
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    getCart(token)
      .then((res) => setCart(res.data))
      .catch((err) => {
        console.error('Failed to load cart:', err);
      });
  }, [token, navigate]);

  const total =
    cart.items?.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ) || 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fb',
        padding: '40px 6%',
      }}
    >
      <h2
        style={{
          fontSize: '32px',
          marginBottom: '30px',
          color: '#17172b',
        }}
      >
        Your Cart
      </h2>

      {cart.items?.length === 0 ? (
        <div
          style={{
            background: '#fff',
            padding: '40px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
          }}
        >
          <h3>Your cart is empty</h3>
          <button
            onClick={() => navigate('/products')}
            style={{
              marginTop: '15px',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              background: '#17172b',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: '600',
            }}
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 320px',
            gap: '25px',
            alignItems: 'start',
          }}
        >
          {/* Cart Items */}
          <div>
            {cart.items.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '18px',
                  marginBottom: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
                }}
              >
                {/* Product Image */}
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    flexShrink: 0,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#f0f0f0',
                  }}
                >
                  <img
                    src={
                      item.image ||
                      'https://placehold.co/300x300?text=Product'
                    }
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://placehold.co/300x300?text=Product';
                    }}
                  />
                </div>

                {/* Product Information */}
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      margin: '0 0 8px',
                      color: '#17172b',
                      fontSize: '20px',
                    }}
                  >
                    {item.name}
                  </h3>

                  <p
                    style={{
                      margin: '5px 0',
                      color: '#666',
                    }}
                  >
                    Quantity: {item.quantity}
                  </p>

                  <p
                    style={{
                      margin: '5px 0',
                      color: '#ff5f5f',
                      fontWeight: '700',
                      fontSize: '18px',
                    }}
                  >
                    ₹{item.price}
                  </p>
                </div>

                {/* Item Total */}
                <div
                  style={{
                    fontWeight: '700',
                    fontSize: '19px',
                    color: '#17172b',
                  }}
                >
                  ₹{item.price * item.quantity}
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '25px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.06)',
              position: 'sticky',
              top: '20px',
            }}
          >
            <h3
              style={{
                marginTop: 0,
                fontSize: '22px',
                color: '#17172b',
              }}
            >
              Order Summary
            </h3>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                margin: '20px 0',
                color: '#555',
              }}
            >
              <span>Subtotal</span>
              <span>₹{total}</span>
            </div>

            <div
              style={{
                borderTop: '1px solid #eee',
                paddingTop: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '20px',
                fontWeight: '700',
              }}
            >
              <span>Total</span>
              <span>₹{total}</span>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              style={{
                width: '100%',
                marginTop: '25px',
                padding: '14px',
                border: 'none',
                borderRadius: '10px',
                background: '#17172b',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cart;