
import { useEffect, useRef, useState } from 'react';

import {
  NavLink,
  Link,
  useNavigate,
  useLocation
} from 'react-router-dom';

import { getProfile } from '../api';
import './Navbar.css';

const menuSections = [
  {
    title: 'Your Account',
    items: [
      {
        icon: '👤',
        label: 'My Profile',
        path: '/profile',
        requiresAuth: true
      },
      {
        icon: '📦',
        label: 'My Orders',
        path: '/orders',
        requiresAuth: true
      },
      {
        icon: '🛍️',
        label: 'My Shopping Bag',
        path: '/cart',
        requiresAuth: true
      },
      {
        icon: '♡',
        label: 'My Wishlist',
        path: '/wishlist',
        requiresAuth: true
      },
      {
        icon: '📍',
        label: 'Saved Addresses',
        path: '/profile#address',
        requiresAuth: true
      }
    ]
  },
  {
    title: 'Explore ShopEasy',
    items: [
      {
        icon: '🛒',
        label: 'All Products',
        path: '/products'
      },
      {
        icon: '🎧',
        label: 'Electronics',
        path: '/products?category=Electronics'
      },
      {
        icon: '👕',
        label: 'Fashion',
        path: '/products?category=Fashion'
      },
      {
        icon: '⌚',
        label: 'Accessories',
        path: '/products?category=Accessories'
      }
    ]
  },
  {
    title: 'Help & Settings',
    items: [
      {
        icon: '🤖',
        label: 'AI Customer Support',
        path: '/ai-support'
      },
      {
        icon: '🎧',
        label: 'Customer Service'
      },
      {
        icon: '⚙️',
        label: 'Account Settings',
        path: '/profile',
        requiresAuth: true
      },
      {
        icon: '🛡️',
        label: 'Privacy Policy',
        path: '/privacy'
      },
      {
        icon: '📄',
        label: 'Terms & Conditions',
        path: '/terms'
      }
    ]
  }
];

export default function Navbar() {

  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [customer, setCustomer] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const dialogRef = useRef(null);

  const token = localStorage.getItem('token');

  const currentCustomer =
    customer?.token === token ? customer : null;

  const customerName = currentCustomer?.name || '';

  useEffect(() => {
    let active = true;

    setCustomer(null);

    async function loadCustomer() {

      if (!token) {
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);

      try {
        const res = await getProfile(token);

        if (
          active &&
          localStorage.getItem('token') === token
        ) {
          setCustomer({
            token,
            name: res.data.name || '',
            isVerified: res.data.isVerified === true
          });
        }

      } catch (error) {

        if (!active) return;

        setCustomer(null);

        if (
          error.response?.status === 401 &&
          localStorage.getItem('token') === token
        ) {
          localStorage.removeItem('token');
          setMenuOpen(false);
          navigate('/login', { replace: true });
        }

      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    loadCustomer();

    window.addEventListener(
      'profileUpdated',
      loadCustomer
    );

    return () => {
      active = false;

      window.removeEventListener(
        'profileUpdated',
        loadCustomer
      );
    };

  }, [token, navigate]);

  // Close sidebar when URL changes

  useEffect(() => {
    setMenuOpen(false);
    setNotice('');
  }, [
    location.pathname,
    location.search,
    location.hash
  ]);

  // Sidebar dialog

  useEffect(() => {

    const dialog = dialogRef.current;

    if (!dialog) return;

    if (menuOpen && !dialog.open) {
      dialog.showModal();
    } else if (!menuOpen && dialog.open) {
      dialog.close();
    }

    if (!menuOpen) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };

  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setNotice('');
  };

  const handleLogout = () => {

    localStorage.removeItem('token');

    setCustomer(null);
    setProfileLoading(false);

    closeMenu();

    navigate('/login', { replace: true });
  };

  // Sidebar navigation

  const handleMenuItem = item => {

    if (item.requiresAuth && !token) {
      closeMenu();
      navigate('/login');
      return;
    }

    if (item.path) {

      closeMenu();
      navigate(item.path);

      if (
        item.path === '/profile#address' &&
        location.pathname === '/profile'
      ) {
        requestAnimationFrame(() => {
          document
            .getElementById('address')
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
        });
      }

      return;
    }

    setNotice(`${item.label} — Coming soon.`);
  };

  // Open AI chatbot

  const openAIChat = () => {
    closeMenu();
    navigate('/ai-support');
  };

  // Highlight currently selected page

  const isActiveItem = item => {

    if (!item.path) return false;

    return item.path ===
      `${location.pathname}${location.search}${location.hash}`;
  };

  const customerInitials = customerName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0].toUpperCase())
    .join('');

  return (
    <>

      <nav className="navbar se-nav">

        <button
          type="button"
          className="se-menu-trigger"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >

          <svg
            width="23"
            height="23"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>

          <span>All</span>

        </button>

        <Link className="logo" to="/products">
          <span>S</span>
          ShopEasy.
        </Link>

        <div className="se-nav-links">

          <NavLink to="/products">
            Explore
          </NavLink>

          <NavLink to="/cart">
            Bag
          </NavLink>

          {token ? (

            <button
              type="button"
              className="se-nav-auth"
              onClick={handleLogout}
            >
              Sign out
            </button>

          ) : (

            <NavLink to="/login">
              Sign in
            </NavLink>

          )}

        </div>

      </nav>

      <dialog
        ref={dialogRef}
        className="se-sidebar"
        aria-labelledby="se-sidebar-title"

        onCancel={event => {
          event.preventDefault();
          closeMenu();
        }}

        onClick={event => {

          if (event.target === event.currentTarget) {

            const rect =
              event.currentTarget.getBoundingClientRect();

            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            ) {
              closeMenu();
            }
          }
        }}
      >

        <div className="se-sidebar-header">

          <div className="se-sidebar-avatar">

            {token && customerInitials ? (

              <span
                style={{
                  fontSize: '20px',
                  fontWeight: '800',
                  letterSpacing: '0.5px'
                }}
              >
                {customerInitials}
              </span>

            ) : (

              <svg
                width="27"
                height="27"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
              </svg>

            )}

          </div>

          <div className="se-sidebar-user">

            <small>
              WELCOME TO SHOPEASY
            </small>

            <h2
              id="se-sidebar-title"
              style={{
                overflowWrap: 'anywhere'
              }}
            >

              {token
                ? profileLoading && !customerName
                  ? 'Hello...'
                  : `Hello, ${customerName || 'Customer'}`
                : 'Hello, Sign in'}

            </h2>

            <p>

              {token
                ? 'Manage your shopping experience'
                : 'Discover your next favourite'}

            </p>

            {token && currentCustomer?.isVerified && (

              <span
                style={{
                  display: 'inline-block',
                  marginTop: '7px',
                  color: '#86efac',
                  fontSize: '10px',
                  fontWeight: '600',
                  letterSpacing: '0.4px'
                }}
              >
                ✓ EMAIL VERIFIED
              </span>

            )}

          </div>

          <button
            type="button"
            className="se-sidebar-close"
            aria-label="Close navigation menu"
            onClick={closeMenu}
          >
            ×
          </button>

        </div>

        <div className="se-sidebar-content">

          {notice && (
            <div
              className="se-sidebar-notice"
              role="status"
            >
              {notice}
            </div>
          )}

          {menuSections.map(section => (

            <section
              className="se-sidebar-section"
              key={section.title}
            >

              <h3>{section.title}</h3>

              {section.items.map(item => (

                <button
                  type="button"
                  className="se-sidebar-item"
                  key={item.label}
                  aria-current={
                    isActiveItem(item)
                      ? 'page'
                      : undefined
                  }
                  style={
                    isActiveItem(item)
                      ? {
                          background: '#c1afff12',
                          boxShadow: 'inset 3px 0 #c1afff'
                        }
                      : undefined
                  }
                  onClick={() => handleMenuItem(item)}
                >

                  <span
                    className="se-sidebar-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>

                  <span className="se-sidebar-label">
                    {item.label}
                  </span>

                  {!item.path ? (

                    <span className="se-sidebar-soon">
                      Soon
                    </span>

                  ) : (

                    <span
                      className="se-sidebar-arrow"
                      aria-hidden="true"
                    >
                      ›
                    </span>

                  )}

                </button>

              ))}

            </section>

          ))}

          <div className="se-sidebar-support">

            <div className="se-support-symbol">
              ✦
            </div>

            <h3>
              ShopEasy AI Assistant
            </h3>

            <p>
              Your intelligent shopping companion
              for products, orders and wishlist support.
            </p>

            <button
              type="button"
              onClick={openAIChat}
            >
              Chat with AI Assistant
            </button>

          </div>

          <div className="se-sidebar-bottom">

            {token ? (

              <button
                type="button"
                className="se-sidebar-logout"
                onClick={handleLogout}
              >
                Sign Out
              </button>

            ) : (

              <button
                type="button"
                className="se-sidebar-logout"
                onClick={() => {
                  closeMenu();
                  navigate('/login');
                }}
              >
                Sign In
              </button>

            )}

            <p>
              ShopEasy © {new Date().getFullYear()}
            </p>

            <small>
              Premium Shopping Experience
            </small>

          </div>

        </div>

      </dialog>

    </>
  );
}
