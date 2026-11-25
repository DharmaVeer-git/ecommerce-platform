
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, signup, requestOTP, verifyOTP } from '../api';
import '../index.css';

export default function Login() {

  const [mode, setMode] = useState('login');
  const [stage, setStage] = useState('credentials');

  // CUSTOMER DETAILS

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);

  // OTP AUTHENTICATION

  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');

  // UI STATES

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const navigate = useNavigate();

  // ================= OTP COUNTDOWN =================

  useEffect(() => {

    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown(value => Math.max(0, value - 1));
    }, 1000);

    return () => clearTimeout(timer);

  }, [cooldown]);

  // ================= CHANGE AUTH MODE =================

  function changeMode(nextMode) {

    setMode(nextMode);
    setStage('credentials');

    setError('');
    setNotice('');

    setPassword('');
    setConfirmPassword('');

    setOtp('');
    setChallengeId('');

    setTermsAccepted(false);
    setCooldown(0);

    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  // ================= HANDLE AUTHENTICATION =================

  async function handleSubmit(e) {

    e.preventDefault();

    if (loading) return;

    setError('');
    setNotice('');
    setLoading(true);

    try {

      const cleanEmail = email.trim().toLowerCase();

      // VERIFY OTP

      if (stage === 'otp') {

        const res = await verifyOTP({
          email: cleanEmail,
          otp,
          challengeId
        });

        if (!res.data.token) {
          throw new Error('Authentication failed.');
        }

        localStorage.setItem('token', res.data.token);

        // NEW CUSTOMER: OPEN PROFILE
        // EXISTING CUSTOMER: OPEN PRODUCTS

        navigate(
          mode === 'signup' ? '/profile' : '/products',
          { replace: true }
        );

        return;
      }

      let res;

      // ================= NEW CUSTOMER REGISTRATION =================

      if (mode === 'signup') {

        if (!name.trim() || name.trim().length > 100) {
          throw new Error('Please enter a valid full name.');
        }

        if (!/^[6-9]\d{9}$/.test(phone)) {
          throw new Error(
            'Please enter a valid 10-digit mobile number.'
          );
        }

        if (password.length < 8) {
          throw new Error(
            'Password must contain at least 8 characters.'
          );
        }

        if (new TextEncoder().encode(password).length > 72) {
          throw new Error('Password is too long.');
        }

        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        if (!termsAccepted) {
          throw new Error(
            'Please accept the Terms and Conditions and Privacy Policy.'
          );
        }

        res = await signup({
          name: name.trim(),
          email: cleanEmail,
          phone,
          password,
          termsAccepted
        });

      // ================= PASSWORDLESS LOGIN =================

      } else if (mode === 'otp') {

        res = await requestOTP({
          email: cleanEmail
        });

      // ================= PASSWORD LOGIN =================

      } else {

        res = await login({
          email: cleanEmail,
          password
        });

      }

      if (!res.data.requiresOTP) {
        throw new Error(
          'OTP authentication is currently unavailable.'
        );
      }

      if (mode === 'signup' && !res.data.challengeId) {
        throw new Error(
          'Registration could not be started. Please try again.'
        );
      }

      setEmail(cleanEmail);
      setChallengeId(res.data.challengeId || '');

      setStage('otp');

      setPassword('');
      setConfirmPassword('');
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

  // ================= RESEND OTP =================

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

  // ================= USER INTERFACE =================

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
                : mode === 'signup'
                ? 'Create your personal shopping profile.'
                : 'Your premium shopping experience awaits.'}

            </p>

          </div>

          {/* REGISTRATION INFORMATION */}

          {mode === 'signup' && stage === 'credentials' && (

            <div
              style={{
                padding: '12px 15px',
                marginBottom: '20px',
                background: 'rgba(155, 135, 245, 0.08)',
                border: '1px solid rgba(155, 135, 245, 0.20)',
                borderRadius: '12px',
                fontSize: '12px',
                lineHeight: '1.7',
                color: '#a99bd6'
              }}
            >

              <strong>✦ Your personal ShopEasy account</strong>

              <p style={{ margin: '5px 0 0' }}>
                Your registration details will automatically
                be saved to your customer profile after
                successful email verification.
              </p>

            </div>

          )}

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

                {/* FULL NAME */}

                {mode === 'signup' && (

                  <label className="field-group">

                    <span>FULL NAME</span>

                    <input
                      type="text"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={e =>
                        setName(e.target.value)
                      }
                      maxLength={100}
                      autoComplete="name"
                      required
                    />

                  </label>

                )}

                {/* EMAIL ADDRESS */}

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

                {/* MOBILE NUMBER */}

                {mode === 'signup' && (

                  <label className="field-group">

                    <span>MOBILE NUMBER</span>

                    <div
                      style={{
                        position: 'relative',
                        width: '100%'
                      }}
                    >

                      <span
                        style={{
                          position: 'absolute',
                          left: '16px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '14px',
                          color: '#a99bd6',
                          fontWeight: '600',
                          pointerEvents: 'none'
                        }}
                      >
                        +91
                      </span>

                      <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="Enter mobile number"
                        value={phone}
                        onChange={e =>
                          setPhone(
                            e.target.value
                              .replace(/\D/g, '')
                              .slice(0, 10)
                          )
                        }
                        maxLength={10}
                        pattern="[6-9][0-9]{9}"
                        autoComplete="tel-national"
                        style={{
                          paddingLeft: '60px',
                          width: '100%'
                        }}
                        required
                      />

                    </div>

                    <small
                      style={{
                        fontSize: '11px',
                        color: '#999'
                      }}
                    >
                      Used for your account and delivery details.
                    </small>

                  </label>

                )}

                {/* PASSWORD */}

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
                        placeholder={
                          mode === 'signup'
                            ? 'Create a strong password'
                            : 'Enter your password'
                        }
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

                    {mode === 'signup' && (

                      <small
                        style={{
                          fontSize: '11px',
                          color: '#999'
                        }}
                      >
                        Minimum 8 characters.
                      </small>

                    )}

                  </label>

                )}

                {/* CONFIRM PASSWORD */}

                {mode === 'signup' && (

                  <label className="field-group">

                    <span>CONFIRM PASSWORD</span>

                    <div className="password-wrap">

                      <input
                        type={
                          showConfirmPassword
                            ? 'text'
                            : 'password'
                        }
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={e =>
                          setConfirmPassword(e.target.value)
                        }
                        minLength={8}
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword
                          )
                        }
                      >

                        {showConfirmPassword
                          ? 'HIDE'
                          : 'SHOW'}

                      </button>

                    </div>

                    {confirmPassword && (

                      <small
                        style={{
                          fontSize: '12px',
                          color:
                            password === confirmPassword
                              ? '#22c55e'
                              : '#ef4444'
                        }}
                      >

                        {password === confirmPassword
                          ? '✓ Passwords match'
                          : 'Passwords do not match'}

                      </small>

                    )}

                  </label>

                )}

                {/* TERMS AND CONDITIONS */}

                {mode === 'signup' && (

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      fontSize: '12px',
                      lineHeight: '1.7',
                      cursor: 'pointer',
                      margin: '5px 0'
                    }}
                  >

                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e =>
                        setTermsAccepted(e.target.checked)
                      }
                      style={{
                        width: '17px',
                        height: '17px',
                        marginTop: '3px',
                        flexShrink: 0,
                        accentColor: '#9b87f5'
                      }}
                      required
                    />

                    <span>

                      I agree to the{' '}

                      <Link
                        to="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#9b87f5',
                          textDecoration: 'underline'
                        }}
                      >
                        Terms & Conditions
                      </Link>

                      {' '}and{' '}

                      <Link
                        to="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: '#9b87f5',
                          textDecoration: 'underline'
                        }}
                      >
                        Privacy Policy
                      </Link>

                      .

                    </span>

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
                  ? 'CREATE ACCOUNT & VERIFY'
                  : 'SEND OTP'}

              </span>

              <span className="submit-arrow">↗</span>

            </button>

          </form>

          {/* OTP OPTIONS */}

          {stage === 'otp' ? (

            <>

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

              {/* RESEND OTP */}

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

              {/* ================= ADMIN LOGIN ================= */}

              {mode === 'login' && (

                <div className="admin-access-section">

                  <div className="admin-access-divider">

                    <span />

                    <small>MANAGEMENT PORTAL</small>

                    <span />

                  </div>

                  <Link
                    to="/admin"
                    className="admin-access-link"
                  >

                    <div className="admin-access-icon">

                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >

                        <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />

                        <path d="m9 12 2 2 4-4" />

                      </svg>

                    </div>

                    <div className="admin-access-text">

                      <strong>Admin Login</strong>

                      <small>
                        Authorized administrators only
                      </small>

                    </div>

                    <span className="admin-access-arrow">
                      ↗
                    </span>

                  </Link>

                </div>

              )}

            </>

          )}

        </div>

        <footer className="auth-footer">

          <span>
            © {new Date().getFullYear()} SHOPEASY
          </span>

          <span>SECURE BY DESIGN.</span>

        </footer>

      </section>

    </main>

  );
}
