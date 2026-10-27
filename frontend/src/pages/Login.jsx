
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../api';
import '../index.css';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignup) {
        await signup({ name, email, password });
        setIsSignup(false);
        setPassword('');
        setError('ACCOUNT_CREATED');
      } else {
        const res = await login({ email, password });
        localStorage.setItem('token', res.data.token);
        navigate('/products');
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Unable to connect. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-visual">
        <div className="visual-grid" />
        <div className="visual-orb orb-one" />
        <div className="visual-orb orb-two" />

        <a className="brand-mark" href="/login">
          <span className="brand-symbol">S</span>
          <span>SHOPEASY<span className="brand-dot">.</span></span>
        </a>

        <div className="visual-copy">
          <span className="eyebrow">
            <span className="live-dot" /> THE ART OF DISCOVERY
          </span>

          <h1>
            Your next
            <br />
            obsession
            <br />
            <span>starts here.</span>
          </h1>

          <p>
            Extraordinary finds. Effortless shopping.
            A better way to discover what you love.
          </p>

          <div className="visual-stats">
            <div>
              <strong>01</strong>
              <span>Discover</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Experience</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Enjoy</span>
            </div>
          </div>
        </div>

        <div className="floating-product product-one">
          <span className="product-icon">✳</span>
          <div>
            <strong>Find your next favorite.</strong>
            <span>Curated for your lifestyle</span>
          </div>
        </div>

        <div className="floating-product product-two">
          <span className="product-spark">✦</span>
          <div>
            <strong>Good taste.</strong>
            <span>Great discoveries.</span>
          </div>
        </div>

        <span className="visual-index">SHOPEASY / 001</span>
      </section>

      <section className="auth-panel">
        <div className="auth-topline">
          <span>YOUR SPACE. YOUR STYLE.</span>
          <span>01 — 03</span>
        </div>

        <div className="auth-form-wrap">
          <div className="form-intro">
            <div className="form-icon">✳</div>
            <p className="form-kicker">
              {isSignup ? 'YOUR JOURNEY BEGINS' : 'WELCOME BACK'}
            </p>
            <h2>
              {isSignup ? 'Create your account.' : 'Good to see you.'}
            </h2>
            <p className="form-subtitle">
              {isSignup
                ? 'Join ShopEasy and discover something different.'
                : 'Sign in and pick up where you left off.'}
            </p>
          </div>

          {error === 'ACCOUNT_CREATED' && (
            <div className="auth-notice">
              Account created successfully. You can now sign in.
            </div>
          )}

          {error && error !== 'ACCOUNT_CREATED' && (
            <div className="auth-error">{error}</div>
          )}

          <form className="premium-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="field-group">
                <span>FULL NAME</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            )}

            <label className="field-group">
              <span>EMAIL ADDRESS</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <label className="field-group">
              <span>PASSWORD</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={
                    isSignup ? 'new-password' : 'current-password'
                  }
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </label>

            {!isSignup && (
              <div className="form-options">
                <span>SECURE SIGN IN</span>
                <span>JWT PROTECTED</span>
              </div>
            )}

            <button
              className="premium-submit"
              type="submit"
              disabled={loading}
            >
              <span>
                {loading
                  ? 'PLEASE WAIT...'
                  : isSignup
                    ? 'CREATE ACCOUNT'
                    : 'SIGN IN TO SHOPEASY'}
              </span>
              <span className="submit-arrow">↗</span>
            </button>
          </form>

          <div className="auth-switch">
            <span>
              {isSignup ? 'Already part of ShopEasy?' : 'New to ShopEasy?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup);
                setError('');
              }}
            >
              {isSignup ? 'Sign in' : 'Create an account'} ↗
            </button>
          </div>
        </div>

        <footer className="auth-footer">
          <span>© 2026 SHOPEASY</span>
          <span>MADE FOR THE CURIOUS.</span>
        </footer>
      </section>
    </main>
  );
}
