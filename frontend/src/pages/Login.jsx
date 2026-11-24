
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup, requestOTP, verifyOTP } from '../api';
import '../index.css';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [stage, setStage] = useState('credentials');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown(value => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setStage('credentials');
    setError('');
    setNotice('');
    setPassword('');
    setOtp('');
    setChallengeId('');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (loading) return;

    setError('');
    setNotice('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (stage === 'otp') {
        const res = await verifyOTP({
          email: cleanEmail,
          otp,
          challengeId
        });

        if (!res.data.token) {
          throw new Error('Authentication failed');
        }

        localStorage.setItem('token', res.data.token);

        navigate('/products', { replace: true });

        return;
      }

      let res;

      if (mode === 'signup') {
        res = await signup({
          name,
          email: cleanEmail,
          password
        });
      } else if (mode === 'otp') {
        res = await requestOTP({
          email: cleanEmail
        });
      } else {
        res = await login({
          email: cleanEmail,
          password
        });
      }

      if (!res.data.requiresOTP) {
        throw new Error('OTP backend is not ready yet');
      }

      setEmail(cleanEmail);
      setChallengeId(res.data.challengeId || '');
      setStage('otp');
      setPassword('');
      setOtp('');
      setCooldown(60);

      setNotice(
        mode === 'otp'
          ? 'If your account exists, an OTP will be sent.'
          : 'Verification code sent to your email.'
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendOTP() {
    if (cooldown > 0 || loading) return;

    setLoading(true);
    setError('');
    setNotice('');

    try {
      await requestOTP({
        email,
        challengeId
      });

      setOtp('');
      setCooldown(60);

      setNotice(
        'If your account exists, a new code will be sent.'
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to request OTP.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-screen">

      {/* LEFT SIDE VISUAL SECTION */}

      <section className="auth-visual">

        <div className="visual-grid" />

        <div className="visual-orb orb-one" />

        <div className="visual-orb orb-two" />

        <a className="brand-mark" href="/login">

          <span className="brand-symbol">S</span>

          <span>
            SHOPEASY
            <span className="brand-dot">.</span>
          </span>

        </a>

        <div className="visual-copy">

          <span className="eyebrow">

            <span className="live-dot" />

            THE ART OF DISCOVERY

          </span>

          <h1>
            Your next<br />
            obsession<br />
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
            <strong>Secure shopping.</strong>
            <span>Verified email authentication</span>
          </div>

        </div>

        <span className="visual-index">
          SHOPEASY / 001
        </span>

      </section>

      {/* RIGHT SIDE AUTHENTICATION PANEL */}

      <section className="auth-panel">

        <div className="auth-topline">

          <span>YOUR SPACE. YOUR STYLE.</span>

          <span>SECURE ACCESS</span>

        </div>

        <div className="auth-form-wrap">

          <div className="form-intro">

            <div className="form-icon">
              {stage === 'otp' ? '✓' : '✳'}
            </div>

            <p className="form-kicker">

              {stage === 'otp'
                ? 'SECURE VERIFICATION'
                : 'WELCOME TO SHOPEASY'}

            </p>

            <h2>

              {stage === 'otp'
                ? 'Verify your email.'
                : mode === 'signup'
                ? 'Create your account.'
                : mode === 'otp'
                ? 'Login with OTP.'
                : 'Good to see you.'}

            </h2>

            <p className="form-subtitle">

              {stage === 'otp'
                ? `Enter the six-digit code sent to ${email}`
                : 'Your premium shopping experience awaits.'}

            </p>

          </div>

          {/* ERROR MESSAGE */}

          {error && (

            <div className="auth-error" role="alert">

              {error}

            </div>

          )}

          {/* SUCCESS MESSAGE */}

          {notice && (

            <div className="auth-notice" role="status">

              {notice}

            </div>

          )}

          {/* AUTHENTICATION FORM */}

          <form
            className="premium-form"
            onSubmit={handleSubmit}
          >

            {stage === 'otp' ? (

              <>

                <label className="field-group">

                  <span>VERIFICATION CODE</span>

                  <input
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
                    style={{
                      textAlign: 'center',
                      fontSize: '30px',
                      letterSpacing: '12px',
                      height: '70px'
                    }}
                    required
                    autoFocus
                  />

                </label>

                <div className="form-options">

                  <span>6-DIGIT CODE</span>

                  <span>VALID FOR 5 MINUTES</span>

                </div>

              </>

            ) : (

              <>

                {mode === 'signup' && (

                  <label className="field-group">

                    <span>FULL NAME</span>

                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={e =>
                        setName(e.target.value)
                      }
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
                    onChange={e =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                    required
                  />

                </label>

                {mode !== 'otp' && (

                  <label className="field-group">

                    <span>PASSWORD</span>

                    <div className="password-wrap">

                      <input
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        placeholder="Enter your password"
                        value={password}
                        onChange={e =>
                          setPassword(e.target.value)
                        }
                        minLength={
                          mode === 'signup' ? 8 : 1
                        }
                        autoComplete={
                          mode === 'signup'
                            ? 'new-password'
                            : 'current-password'
                        }
                        required
                      />

                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() =>
                          setShowPassword(!showPassword)
                        }
                      >

                        {showPassword ? 'HIDE' : 'SHOW'}

                      </button>

                    </div>

                  </label>

                )}

              </>

            )}

            {/* MAIN SUBMIT BUTTON */}

            <button
              className="premium-submit"
              type="submit"
              disabled={
                loading ||
                (stage === 'otp' && otp.length !== 6)
              }
            >

              <span>

                {loading
                  ? 'PLEASE WAIT...'
                  : stage === 'otp'
                  ? 'VERIFY & CONTINUE'
                  : mode === 'signup'
                  ? 'CREATE ACCOUNT'
                  : 'SEND OTP'}

              </span>

              <span className="submit-arrow">↗</span>

            </button>

          </form>

          {stage === 'otp' ? (

            <>

              {/* NEW SPAM FOLDER NOTIFICATION */}

              <div className="otp-spam-notice">

                <strong>
                  📩 Didn't receive the OTP?
                </strong>

                <p>
                  Please check your Spam or Junk folder.
                  Sometimes verification emails may be
                  filtered into these folders.
                  If you still haven't received the code,
                  try resending it after 60 seconds.
                </p>

                <a
                  href="https://mail.google.com/mail/u/0/#spam"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check Gmail Spam Folder ↗
                </a>

              </div>

              {/* RESEND OTP OPTION */}

              <div className="auth-switch">

                <span>Didn't receive the code?</span>

                <button
                  type="button"
                  onClick={resendOTP}
                  disabled={cooldown > 0 || loading}
                >

                  {cooldown > 0
                    ? `Resend in ${cooldown}s`
                    : 'Resend OTP'}

                </button>

              </div>

              {/* BACK TO LOGIN */}

              <div className="auth-switch">

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => changeMode('login')}
                >

                  ← Back to login

                </button>

              </div>

            </>

          ) : (

            <>

              {/* PASSWORDLESS LOGIN OPTION */}

              <div className="auth-switch">

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    changeMode(
                      mode === 'otp' ? 'login' : 'otp'
                    )
                  }
                >

                  {mode === 'otp'
                    ? 'Login with password'
                    : 'Login with email OTP'} ↗

                </button>

              </div>

              {/* SIGNUP AND LOGIN SWITCH */}

              <div className="auth-switch">

                <span>

                  {mode === 'signup'
                    ? 'Already have an account?'
                    : 'New to ShopEasy?'}

                </span>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    changeMode(
                      mode === 'signup' ? 'login' : 'signup'
                    )
                  }
                >

                  {mode === 'signup'
                    ? 'Sign in'
                    : 'Create an account'} ↗

                </button>

              </div>

            </>

          )}

        </div>

        <footer className="auth-footer">

          <span>© 2026 SHOPEASY</span>

          <span>SECURE BY DESIGN.</span>

        </footer>

      </section>

    </main>
  );
}
