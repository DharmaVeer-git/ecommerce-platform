
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAdmin } from '../api';
import './Admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminAccess = async () => {
    setError('');

    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    try {
      setLoading(true);

      await verifyAdmin(token);

      navigate('/admin/dashboard');

    } catch (err) {
      const status = err.response?.status;

      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (status === 403) {
        setError('Access denied. Administrator only.');
      } else {
        setError('Unable to connect to admin service.');
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">

        <div className="admin-shield">🛡️</div>

        <span className="admin-tag">
          RESTRICTED ACCESS
        </span>

        <h1>ShopEasy Admin</h1>

        <p>
          Private management portal for the
          authorized website owner.
        </p>

        {error && (
          <div className="admin-error">
            {error}
          </div>
        )}

        <button
          className="admin-primary-btn"
          onClick={handleAdminAccess}
          disabled={loading}
        >
          {loading
            ? 'Verifying access...'
            : 'Access Admin Dashboard'}
        </button>

        <button
          className="admin-secondary-btn"
          onClick={() => navigate('/login')}
        >
          Sign in with your owner account
        </button>

        <div className="admin-footer">
          Secured by JWT Authentication
        </div>

      </div>
    </div>
  );
}
