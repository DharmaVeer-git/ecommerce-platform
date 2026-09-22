import { useEffect, useState } from 'react';
import { getProducts, addToCart } from '../api';

function Products() {
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getProducts().then((res) => setProducts(res.data));
  }, []);

  const handleAddToCart = async (productId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('Please login first');
      return;
    }
    try {
      await addToCart({ productId, quantity: 1 }, token);
      setMessage('Added to cart!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Failed to add to cart');
    }
  };

  return (
    <div className="products-page">
      <h2>Our Products</h2>
      {message && <div className="message-banner">{message}</div>}
      <div className="product-grid">
        {products.map((p, i) => (
          <div className="product-card" key={p._id} style={{ animationDelay: `${i * 0.05}s` }}>
            <img src={p.image || 'https://via.placeholder.com/300x180?text=Product'} alt={p.name} />
            <div className="product-card-body">
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <span className="price">₹{p.price}</span>
              <button onClick={() => handleAddToCart(p._id)}>Add to Cart</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Products;