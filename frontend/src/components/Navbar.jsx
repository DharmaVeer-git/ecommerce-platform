import { Link, useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <span className="logo">🛍️ ShopEasy</span>
      <Link to="/products">Products</Link>
      <Link to="/cart">Cart</Link>
      {token ? (
        <button onClick={handleLogout}>Logout</button>
      ) : (
        <Link to="/login" style={{ marginLeft: 'auto' }}>Login</Link>
      )}
    </nav>
  );
}

export default Navbar;