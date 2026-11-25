
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  getProfile,
  updateProfile,
  updateAddress
} from '../api';

import './Profile.css';

const emptyAddress = {
  fullName: '',
  phone: '',
  street: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India'
};

export default function Profile() {

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [editing, setEditing] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [address, setAddress] = useState({
    ...emptyAddress
  });

  // ================= LOAD CUSTOMER PROFILE =================

  useEffect(() => {

    let active = true;

    async function loadProfile() {

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {

        const res = await getProfile(token);

        if (!active) return;

        const user = res.data;

        setProfile(user);
        setName(user.name || '');
        setPhone(user.phone || '');

        setAddress({
          ...emptyAddress,
          ...user.address,
          fullName: user.address?.fullName || user.name || '',
          phone: user.address?.phone || user.phone || ''
        });

      } catch (err) {

        if (!active) return;

        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { replace: true });
          return;
        }

        setError(
          err.response?.data?.message ||
          'Unable to load your profile.'
        );

      } finally {

        if (active) setLoading(false);

      }
    }

    loadProfile();

    return () => {
      active = false;
    };

  }, [token, navigate]);

  // ================= ERROR HANDLING =================

  function handleError(err) {

    if (err.response?.status === 401) {

      localStorage.removeItem('token');

      navigate('/login', { replace: true });

      return;
    }

    setError(
      err.response?.data?.message ||
      err.message ||
      'Something went wrong. Please try again.'
    );
  }

  // ================= SAVE PROFILE =================

  async function saveProfile(e) {

    e.preventDefault();

    if (saving) return;

    setError('');
    setNotice('');

    if (!name.trim() || name.trim().length > 100) {
      setError('Please enter a valid full name.');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Please enter a valid mobile number.');
      return;
    }

    setSaving(true);

    try {

      const res = await updateProfile(
        {
          name: name.trim(),
          phone
        },
        token
      );

      setProfile(res.data.user);
      setName(res.data.user.name);
      setPhone(res.data.user.phone);

      setEditing(false);

      setNotice('Your profile has been updated successfully.');

      window.dispatchEvent(new Event('profileUpdated'));

    } catch (err) {

      handleError(err);

    } finally {

      setSaving(false);

    }
  }

  // ================= UPDATE ADDRESS FIELD =================

  function changeAddress(field, value) {

    setAddress(previous => ({
      ...previous,
      [field]: value
    }));

  }

  // ================= SAVE DELIVERY ADDRESS =================

  async function saveAddress(e) {

    e.preventDefault();

    if (saving) return;

    setError('');
    setNotice('');

    if (!/^[6-9]\d{9}$/.test(address.phone)) {
      setError('Enter a valid delivery mobile number.');
      return;
    }

    if (!/^[1-9]\d{5}$/.test(address.pincode)) {
      setError('Enter a valid six-digit PIN code.');
      return;
    }

    setSaving(true);

    try {

      const res = await updateAddress(address, token);

      setProfile(res.data.user);

      setAddress({
        ...emptyAddress,
        ...res.data.user.address
      });

      setEditingAddress(false);

      setNotice('Your delivery address has been saved.');

    } catch (err) {

      handleError(err);

    } finally {

      setSaving(false);

    }
  }

  // ================= CANCEL EDITING =================

  function cancelProfileEdit() {

    setName(profile.name || '');
    setPhone(profile.phone || '');

    setEditing(false);
    setError('');

  }

  function cancelAddressEdit() {

    setAddress({
      ...emptyAddress,
      ...profile.address,
      fullName: profile.address?.fullName || profile.name || '',
      phone: profile.address?.phone || profile.phone || ''
    });

    setEditingAddress(false);
    setError('');

  }

  // ================= SIGN OUT =================

  function signOut() {

    localStorage.removeItem('token');

    navigate('/login', { replace: true });

  }
  useEffect(() => {

  if (!loading && window.location.hash === '#address') {

    document.getElementById('address')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });

  }

}, [loading, profile]);

  // ================= LOADING SCREEN =================

  if (loading) {

    return (
      <main className="sp-page">
        <div className="sp-loading">
          <div className="sp-spinner" />
          <h2>Loading your profile...</h2>
          <p>Preparing your personal shopping space.</p>
        </div>
      </main>
    );

  }

  if (!profile) {

    return (
      <main className="sp-page">
        <div className="sp-loading">
          <h2>Unable to load profile</h2>
          <p>{error}</p>

          <button
            className="sp-primary"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </main>
    );

  }

  const initials = (profile.name || 'Customer')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join('');

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(
        'en-IN',
        {
          month: 'long',
          year: 'numeric'
        }
      )
    : 'Not available';

  const hasAddress = Boolean(
    profile.address?.street &&
    profile.address?.city &&
    profile.address?.pincode
  );

  // ================= PROFILE INTERFACE =================

  return (

    <main className="sp-page">

      <div className="sp-container">

        <div className="sp-topbar">

          <div>
            <span className="sp-kicker">
              YOUR PERSONAL SPACE
            </span>

            <h1>My Profile.</h1>

            <p>
              Manage your account and shopping preferences.
            </p>
          </div>

          <button
            className="sp-secondary"
            onClick={() => navigate('/products')}
          >
            ← Continue Shopping
          </button>

        </div>

        {/* CUSTOMER HEADER */}

        <section className="sp-hero">

          <div className="sp-avatar">
            {initials}
          </div>

          <div className="sp-hero-details">

            <span className="sp-kicker">
              SHOPEASY MEMBER
            </span>

            <h2>Hello, {profile.name}</h2>

            <p>{profile.email}</p>

            <div className="sp-badges">

              {profile.isVerified && (
                <span className="sp-verified">
                  ✓ Email Verified
                </span>
              )}

              <span className="sp-member">
                Member since {memberSince}
              </span>

            </div>

          </div>

        </section>

        {error && (
          <div className="sp-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="sp-success" role="status">
            {notice}
          </div>
        )}

        {!profile.phone && (

          <div className="sp-reminder">

            <strong>Complete your profile</strong>

            <p>
              Add your mobile number to complete
              your customer account.
            </p>

            <button
              className="sp-secondary"
              onClick={() => setEditing(true)}
            >
              Complete Profile
            </button>

          </div>

        )}

        <div className="sp-grid">

          {/* PERSONAL INFORMATION */}

          {/* DELIVERY ADDRESS */}

          <section className="sp-card" id="address">

            <div className="sp-card-heading">

              <div>

                <span className="sp-section-icon">👤</span>

                <h2>Personal Information</h2>

                <p>Your registered account details.</p>

              </div>

              {!editing && (

                <button
                  className="sp-secondary"
                  onClick={() => {
                    setEditing(true);
                    setNotice('');
                  }}
                >
                  Edit
                </button>

              )}

            </div>

            {editing ? (

              <form
                className="sp-form"
                onSubmit={saveProfile}
              >

                <label>
                  Full Name

                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                    autoComplete="name"
                    required
                  />

                </label>

                <label>
                  Email Address

                  <input
                    type="email"
                    value={profile.email}
                    disabled
                  />

                  <small>
                    Your verified email cannot be changed here.
                  </small>

                </label>

                <label>
                  Mobile Number

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    placeholder="10-digit mobile number"
                    onChange={e =>
                      setPhone(
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 10)
                      )
                    }
                    maxLength={10}
                    pattern="[6-9][0-9]{9}"
                    required
                  />

                </label>

                <div className="sp-actions">

                  <button
                    className="sp-primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>

                  <button
                    className="sp-secondary"
                    type="button"
                    onClick={cancelProfileEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            ) : (

              <div className="sp-details">

                <div className="sp-detail">
                  <span>Full Name</span>
                  <strong>{profile.name}</strong>
                </div>

                <div className="sp-detail">
                  <span>Email Address</span>
                  <strong>{profile.email}</strong>
                </div>

                <div className="sp-detail">
                  <span>Mobile Number</span>
                  <strong>
                    {profile.phone
                      ? `+91 ${profile.phone}`
                      : 'Not provided'}
                  </strong>
                </div>

                <div className="sp-detail">
                  <span>Customer ID</span>
                  <strong className="sp-id">
                    {profile._id}
                  </strong>
                </div>

                <div className="sp-detail">
                  <span>Member Since</span>
                  <strong>{memberSince}</strong>
                </div>

              </div>

            )}

          </section>

          {/* DELIVERY ADDRESS */}

          <section className="sp-card">

            <div className="sp-card-heading">

              <div>

                <span className="sp-section-icon">📍</span>

                <h2>Delivery Address</h2>

                <p>Manage your saved delivery location.</p>

              </div>

              {!editingAddress && (

                <button
                  className="sp-secondary"
                  onClick={() => {
                    setEditingAddress(true);
                    setNotice('');
                  }}
                >
                  {hasAddress ? 'Edit' : '+ Add'}
                </button>

              )}

            </div>

            {editingAddress ? (

              <form
                className="sp-form"
                onSubmit={saveAddress}
              >

                <label>
                  Recipient Name

                  <input
                    value={address.fullName}
                    onChange={e =>
                      changeAddress('fullName', e.target.value)
                    }
                    maxLength={100}
                    required
                  />

                </label>

                <label>
                  Mobile Number

                  <input
                    type="tel"
                    inputMode="numeric"
                    value={address.phone}
                    onChange={e =>
                      changeAddress(
                        'phone',
                        e.target.value
                          .replace(/\D/g, '')
                          .slice(0, 10)
                      )
                    }
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    required
                  />

                </label>

                <label>
                  House / Flat / Street

                  <textarea
                    value={address.street}
                    onChange={e =>
                      changeAddress('street', e.target.value)
                    }
                    placeholder="House number, building and street"
                    maxLength={250}
                    required
                  />

                </label>

                <label>
                  Landmark (Optional)

                  <input
                    value={address.landmark}
                    onChange={e =>
                      changeAddress('landmark', e.target.value)
                    }
                    maxLength={250}
                  />

                </label>

                <div className="sp-form-row">

                  <label>
                    City

                    <input
                      value={address.city}
                      onChange={e =>
                        changeAddress('city', e.target.value)
                      }
                      maxLength={100}
                      required
                    />

                  </label>

                  <label>
                    State

                    <input
                      value={address.state}
                      onChange={e =>
                        changeAddress('state', e.target.value)
                      }
                      maxLength={100}
                      required
                    />

                  </label>

                </div>

                <div className="sp-form-row">

                  <label>
                    PIN Code

                    <input
                      inputMode="numeric"
                      value={address.pincode}
                      onChange={e =>
                        changeAddress(
                          'pincode',
                          e.target.value
                            .replace(/\D/g, '')
                            .slice(0, 6)
                        )
                      }
                      maxLength={6}
                      pattern="[1-9][0-9]{5}"
                      required
                    />

                  </label>

                  <label>
                    Country

                    <input value="India" disabled />

                  </label>

                </div>

                <div className="sp-actions">

                  <button
                    className="sp-primary"
                    type="submit"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Address'}
                  </button>

                  <button
                    className="sp-secondary"
                    type="button"
                    onClick={cancelAddressEdit}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                </div>

              </form>

            ) : hasAddress ? (

              <div className="sp-address-display">

                <span className="sp-address-tag">
                  SAVED ADDRESS
                </span>

                <h3>{profile.address.fullName}</h3>

                <p>{profile.address.street}</p>

                {profile.address.landmark && (
                  <p>Near {profile.address.landmark}</p>
                )}

                <p>
                  {profile.address.city},{' '}
                  {profile.address.state} -{' '}
                  {profile.address.pincode}
                </p>

                <p>{profile.address.country || 'India'}</p>

                <strong>
                  +91 {profile.address.phone}
                </strong>

              </div>

            ) : (

              <div className="sp-empty">

                <div className="sp-empty-icon">📦</div>

                <h3>No delivery address saved</h3>

                <p>
                  Add your delivery address to keep
                  your shopping details ready.
                </p>

                <button
                  className="sp-primary"
                  onClick={() => setEditingAddress(true)}
                >
                  + Add Delivery Address
                </button>

              </div>

            )}

          </section>

          {/* ACCOUNT SECURITY */}

          <section className="sp-card">

            <div className="sp-card-heading">

              <div>

                <span className="sp-section-icon">🛡️</span>

                <h2>Account Security</h2>

                <p>Your account protection information.</p>

              </div>

            </div>

            <div className="sp-details">

              <div className="sp-detail">
                <span>Email Verification</span>
                <strong className="sp-green">
                  {profile.isVerified ? 'Verified' : 'Not verified'}
                </strong>
              </div>

              <div className="sp-detail">
                <span>Authentication</span>
                <strong>Email OTP</strong>
              </div>

              <div className="sp-detail">
                <span>Mobile Verification</span>
                <strong>Not verified</strong>
              </div>

              <div className="sp-detail">
                <span>Terms Acceptance</span>
                <strong>
                  {profile.termsAccepted
                    ? 'Accepted'
                    : 'Not recorded'}
                </strong>
              </div>

            </div>

          </section>

          {/* SHOPPING ACCOUNT */}

          <section className="sp-card">

            <div className="sp-card-heading">

              <div>

                <span className="sp-section-icon">🛍️</span>

                <h2>Your Shopping Account</h2>

                <p>Explore and manage your shopping experience.</p>

              </div>

            </div>

            <div className="sp-quick-links">
                <button onClick={() => navigate('/orders')}>
                  <span>My Orders</span>
                  <span>↗</span>
                </button>

              <button onClick={() => navigate('/products')}>
                <span>Explore Products</span>
                <span>↗</span>
              </button>

              <button onClick={() => navigate('/cart')}>
                <span>My Shopping Bag</span>
                <span>↗</span>
              </button>

              <button onClick={() => navigate('/terms')}>
                <span>Terms & Conditions</span>
                <span>↗</span>
              </button>

              <button onClick={() => navigate('/privacy')}>
                <span>Privacy Policy</span>
                <span>↗</span>
              </button>

            </div>

          </section>

        </div>

        <section className="sp-bottom">

          <div>

            <h3>Manage your session</h3>

            <p>Sign out of your ShopEasy customer account.</p>

          </div>

          <button
            className="sp-logout"
            onClick={signOut}
          >
            Sign Out
          </button>

        </section>

        <footer className="sp-footer">
          © {new Date().getFullYear()} ShopEasy.
          Your personal shopping space.
        </footer>

      </div>

    </main>

  );
}
