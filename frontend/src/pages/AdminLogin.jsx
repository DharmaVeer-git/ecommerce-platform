import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  login,
  verifyOTP,
  requestOTP,
  verifyAdmin
} from '../api';

import './Admin.css';

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');

  const [stage, setStage] = useState('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const busy = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown(value => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (busy.current) return;

    busy.current = true;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (stage === 'credentials') {
        const response = await login({
          email: cleanEmail,
          password
        });

        if (!response.data.requiresOTP) {
          throw new Error(
            'OTP authentication is unavailable.'
          );
        }

        setEmail(cleanEmail);
        setChallengeId(response.data.challengeId || '');
        setPassword('');
        setOtp('');
        setStage('otp');
        setCooldown(60);

        setNotice(
          'Verification code sent to your email.'
        );

        return;
      }

      const response = await verifyOTP({
        email: cleanEmail,
        otp,
        challengeId
      });

      const token = response.data.token;

      if (!token) {
        throw new Error('Authentication failed.');
      }

      // Verify that the account belongs to the owner
      await verifyAdmin(token);

      // Independent administrator session
      localStorage.setItem('adminToken', token);

      navigate('/admin/dashboard', {
        replace: true
      });

    } catch (err) {
      const status = err.response?.status;

      if (status === 403) {
        setError('Access denied. Administrator only.');
        setStage('credentials');
        setOtp('');
        setChallengeId('');
      } else {
        setError(
          err.response?.data?.message ||
          err.message ||
          'Unable to complete admin login.'
        );
      }

    } finally {
      setLoading(false);
      busy.current = false;
    }
  }

  async function resendOTP() {
    if (busy.current || cooldown > 0) return;

    busy.current = true;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await requestOTP({
        email,
        challengeId
      });

      if (response.data.challengeId) {
        setChallengeId(response.data.challengeId);
      }

      setOtp('');
      setCooldown(60);

      setNotice(
        'If your account exists, a new code will be sent.'
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to resend verification code.'
      );

    } finally {
      setLoading(false);
      busy.current = false;
    }
  }

  function backToCredentials() {
    setStage('credentials');
    setPassword('');
    setOtp('');
    setChallengeId('');
    setError('');
    setNotice('');
  }

  return (
    <div className="admin-login-page">

      <div className="admin-login-card">

        <div className="admin-shield">
          🛡️
        </div>

        <span className="admin-tag">
          RESTRICTED ACCESS
        </span>

        <h1>ShopEasy Admin</h1>

        <p>
          {stage === 'otp'
            ? `Enter the verification code sent to ${email}`
            : 'Private management portal for the authorized website owner.'}
        </p>

        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="admin-login-notice" role="status">
            {notice}
          </div>
        )}

        <form
          className="admin-auth-form"
          onSubmit={handleSubmit}
        >

          {stage === 'credentials' ? (

            <>

              <label className="admin-auth-field">

                <span>ADMIN EMAIL ADDRESS</span>

                <input
                  type="email"
                  placeholder="Enter administrator email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                  required
                />

              </label>

              <label className="admin-auth-field">

                <span>ADMIN PASSWORD</span>

                <div className="admin-password-wrap">

                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />

                  <button
                    type="button"
                    className="admin-password-toggle"
                    onClick={() =>
                      setShowPassword(previous => !previous)
                    }
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>

                </div>

              </label>

            </>

          ) : (

            <label className="admin-auth-field">

              <span>VERIFICATION CODE</span>

              <input
                className="admin-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                pattern="[0-9]{6}"
                value={otp}
                onChange={e =>
                  setOtp(
                    e.target.value
                      .replace(/\D/g, '')
                      .slice(0, 6)
                  )
                }
                disabled={loading}
                required
                autoFocus
              />

            </label>

          )}

          <button
            className="admin-primary-btn"
            type="submit"
            disabled={
              loading ||
              (stage === 'otp' && otp.length !== 6)
            }
          >

            {loading
              ? 'Please wait...'
              : stage === 'otp'
                ? 'Verify & Access Dashboard'
                : 'Secure Admin Login →'}

          </button>

        </form>

        {stage === 'otp' && (

          <>

            <div className="admin-otp-help">
              Didn't receive the OTP? Check your Spam
              or Junk folder.
            </div>

            <button
              type="button"
              className="admin-secondary-btn"
              onClick={resendOTP}
              disabled={loading || cooldown > 0}
            >

              {cooldown > 0
                ? `Resend OTP in ${cooldown}s`
                : 'Resend OTP'}

            </button>

            <button
              type="button"
              className="admin-secondary-btn"
              onClick={backToCredentials}
              disabled={loading}
            >
              ← Back to Admin Login
            </button>

          </>

        )}

        {stage === 'credentials' && (

          <button
            type="button"
            className="admin-secondary-btn"
            onClick={() => navigate('/login')}
            disabled={loading}
          >
            ← Customer Login
          </button>

        )}

        <div className="admin-footer">
          SECURED BY JWT & EMAIL OTP
        </div>

      </div>

    </div>
  );
}