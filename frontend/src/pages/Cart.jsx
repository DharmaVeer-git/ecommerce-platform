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
    getCart(token).then((res) => setCart(res.data));
  }, []);

  const total = cart.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Your Cart</h2>
      {cart.items?.length === 0 ? (
        <p>Cart is empty</p>
      ) : (
        <>
          {cart.items?.map((item, idx) => (
            <div key={idx} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
              <p>{item.name} × {item.quantity} — ₹{item.price * item.quantity}</p>
            </div>
          ))}
          <h3>Total: ₹{total}</h3>
          <button onClick={() => navigate('/checkout')}>Proceed to Checkout</button>
        </>
      )}
    </div>
  );
}

export default Cart;