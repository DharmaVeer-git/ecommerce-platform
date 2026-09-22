import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { placeOrder, makePayment, getCart } from '../api';

function Checkout() {
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleCheckout = async () => {
    try {
      setStatus('Processing order...');
      const cartRes = await getCart(token);
      const total = cartRes.data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      await placeOrder(token);

      setStatus('Processing payment...');
      const paymentRes = await makePayment({ amount: total, method: 'UPI' }, token);

      setStatus(`✅ ${paymentRes.data.message} — Transaction ID: ${paymentRes.data.transactionId}`);
    } catch (err) {
      setStatus('❌ ' + (err.response?.data?.message || 'Checkout failed'));
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2>Checkout</h2>
      <button onClick={handleCheckout}>Place Order & Pay</button>
      {status && <p style={{ marginTop: '15px' }}>{status}</p>}
      {status.includes('✅') && (
        <button onClick={() => navigate('/products')} style={{ marginTop: '10px' }}>
          Continue Shopping
        </button>
      )}
    </div>
  );
}

export default Checkout;