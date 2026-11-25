
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getOrders } from '../api';

import './Orders.css';

const rupee = (amount) =>
  Number(amount || 0).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR'
  });

const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : 'Not available';

function getStatus(status) {

  switch (status) {

    case 'demo_paid':
      return {
        label: 'Demo payment successful',
        type: 'success'
      };

    case 'paid':
      return {
        label: 'Paid',
        type: 'success'
      };

    case 'delivered':
      return {
        label: 'Delivered',
        type: 'success'
      };

    case 'shipped':
      return {
        label: 'Shipped',
        type: 'pending'
      };

    case 'cancelled':
      return {
        label: 'Cancelled',
        type: 'failed'
      };

    case 'failed':
      return {
        label: 'Payment failed',
        type: 'failed'
      };

    default:
      return {
        label: status || 'Pending',
        type: 'pending'
      };

  }
}

export default function Orders() {

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');

  const [expanded, setExpanded] = useState(null);
  const [reload, setReload] = useState(0);

  // ================= FETCH CUSTOMER ORDERS =================

  useEffect(() => {

    let active = true;

    async function loadOrders() {

      if (!token) {

        navigate('/login', { replace: true });

        return;
      }

      setLoading(true);
      setError('');

      try {

        const res = await getOrders(token);

        if (!active) return;

        const data = Array.isArray(res.data)
          ? res.data
          : res.data?.orders;

        if (!Array.isArray(data)) {
          throw new Error('Invalid order response.');
        }

        setOrders(data);

      } catch (err) {

        if (!active) return;

        if (
          err.response?.status === 401 &&
          localStorage.getItem('token') === token
        ) {

          localStorage.removeItem('token');

          navigate('/login', { replace: true });

          return;
        }

        setError(
          err.response?.data?.message ||
          'Unable to load your orders. Please try again.'
        );

      } finally {

        if (active) setLoading(false);

      }
    }

    loadOrders();

    return () => {
      active = false;
    };

  }, [token, navigate, reload]);

  // ================= ORDER STATISTICS =================

  const demoOrders = orders.filter(
    order => order.status === 'demo_paid'
  );

  const demoTotal = demoOrders.reduce(
    (sum, order) =>
      sum + Number(order.totalAmount || 0),
    0
  );

  // ================= SEARCH AND FILTER =================

  const query = search.trim().toLowerCase();

  const filteredOrders = orders
    .filter(order => {

      const matchesFilter =
        filter === 'all' ||
        order.status === filter;

      const matchesSearch =
        !query ||
        String(order._id || '')
          .toLowerCase()
          .includes(query) ||
        String(order.transactionId || '')
          .toLowerCase()
          .includes(query) ||
        (order.items || []).some(item =>
          String(item.name || '')
            .toLowerCase()
            .includes(query)
        );

      return matchesFilter && matchesSearch;

    })
    .sort((a, b) => {

      if (sort === 'highest') {
        return b.totalAmount - a.totalAmount;
      }

      if (sort === 'lowest') {
        return a.totalAmount - b.totalAmount;
      }

      if (sort === 'oldest') {
        return new Date(a.createdAt) -
          new Date(b.createdAt);
      }

      return new Date(b.createdAt) -
        new Date(a.createdAt);

    });

  const availableStatuses = [
    ...new Set(
      orders.map(order => order.status).filter(Boolean)
    )
  ];

  // ================= PAGE INTERFACE =================

  return (

    <main className="so-page">

      <div className="so-container">

        <header className="so-header">

          <div>

            <span className="so-kicker">
              YOUR SHOPPING HISTORY
            </span>

            <h1>My Orders.</h1>

            <p>
              View your purchases and order information.
            </p>

          </div>

          <button
            className="so-secondary"
            onClick={() => navigate('/products')}
          >
            ← Continue Shopping
          </button>

        </header>

        {loading ? (

          <div className="so-empty">

            <div className="so-spinner" />

            <h2>Loading your orders...</h2>

            <p>
              Retrieving your shopping history.
            </p>

          </div>

        ) : error ? (

          <div className="so-empty">

            <h2>Unable to load orders</h2>

            <p role="alert">{error}</p>

            <button
              className="so-primary"
              onClick={() =>
                setReload(previous => previous + 1)
              }
            >
              Try Again
            </button>

          </div>

        ) : (

          <>

            {/* ================= ORDER STATISTICS ================= */}

            <div className="so-stats">

              <div className="so-stat">

                <span>📦 Total Orders</span>

                <strong>{orders.length}</strong>

                <small>Your order history</small>

              </div>

              <div className="so-stat">

                <span>✓ Successful Demo Orders</span>

                <strong>{demoOrders.length}</strong>

                <small>Simulated payments</small>

              </div>

              <div className="so-stat">

                <span>₹ Demo Order Value</span>

                <strong>{rupee(demoTotal)}</strong>

                <small>No real money charged</small>

              </div>

            </div>

            {/* ================= SEARCH AND FILTERS ================= */}

            <div className="so-toolbar">

              <input
                type="search"
                aria-label="Search orders"
                placeholder="Search products, order ID..."
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
              />

              <select
                aria-label="Filter order status"
                value={filter}
                onChange={event =>
                  setFilter(event.target.value)
                }
              >

                <option value="all">
                  All Orders
                </option>

                {availableStatuses.map(status => (

                  <option
                    key={status}
                    value={status}
                  >
                    {getStatus(status).label}
                  </option>

                ))}

              </select>

              <select
                aria-label="Sort orders"
                value={sort}
                onChange={event =>
                  setSort(event.target.value)
                }
              >

                <option value="newest">
                  Newest First
                </option>

                <option value="oldest">
                  Oldest First
                </option>

                <option value="highest">
                  Highest Amount
                </option>

                <option value="lowest">
                  Lowest Amount
                </option>

              </select>

            </div>

            {/* ================= EMPTY ORDER HISTORY ================= */}

            {filteredOrders.length === 0 ? (

              <div className="so-empty">

                <div className="so-empty-icon">
                  📦
                </div>

                <h2>

                  {orders.length === 0
                    ? 'No orders yet'
                    : 'No matching orders'}

                </h2>

                <p>

                  {orders.length === 0
                    ? 'Your purchases will appear here after checkout.'
                    : 'Try changing your search or filters.'}

                </p>

                <button
                  className="so-primary"
                  onClick={() => {

                    if (orders.length === 0) {

                      navigate('/products');

                    } else {

                      setSearch('');
                      setFilter('all');

                    }

                  }}
                >

                  {orders.length === 0
                    ? 'Start Shopping'
                    : 'Clear Filters'}

                </button>

              </div>

            ) : (

              <div className="so-list">

                <p className="so-count">

                  Showing {filteredOrders.length} of{' '}
                  {orders.length} orders

                </p>

                {filteredOrders.map(order => {

                  const status = getStatus(order.status);

                  const isExpanded =
                    expanded === order._id;

                  const isDemo =
                    order.status === 'demo_paid' ||
                    order.paymentMethod === 'DEMO_UPI' ||
                    String(order.transactionId || '')
                      .startsWith('DEMO-');

                  return (

                    <article
                      className="so-card"
                      key={order._id}
                    >

                      {/* ORDER HEADER */}

                      <div className="so-card-header">

                        <div>

                          <small>ORDER PLACED</small>

                          <strong>
                            {formatDate(order.createdAt)}
                          </strong>

                        </div>

                        <div>

                          <small>ORDER TOTAL</small>

                          <strong>
                            {rupee(order.totalAmount)}
                          </strong>

                        </div>

                        <div>

                          <small>ORDER ID</small>

                          <strong className="so-id">

                            #{String(order._id || '')
                              .slice(-8)
                              .toUpperCase()}

                          </strong>

                        </div>

                        <span
                          className={`so-status ${status.type}`}
                        >

                          {status.label}

                        </span>

                      </div>

                      {/* ORDER PRODUCTS */}

                      <div className="so-items">

                        {(order.items || []).map(
                          (item, index) => (

                            <div
                              className="so-item"
                              key={item._id || index}
                            >

                              <div className="so-product-icon">

                                {(item.name || '?')
                                  .charAt(0)
                                  .toUpperCase()}

                              </div>

                              <div className="so-product-info">

                                <h3>
                                  {item.name || 'Product'}
                                </h3>

                                <p>

                                  Quantity: {item.quantity}

                                </p>

                                <span>

                                  {rupee(item.price)} each

                                </span>

                              </div>

                              <strong>

                                {rupee(
                                  item.price * item.quantity
                                )}

                              </strong>

                            </div>

                          )
                        )}

                      </div>

                      {/* ORDER ACTIONS */}

                      <div className="so-card-actions">

                        <button
                          className="so-secondary"
                          aria-expanded={isExpanded}
                          onClick={() =>
                            setExpanded(
                              isExpanded
                                ? null
                                : order._id
                            )
                          }
                        >

                          {isExpanded
                            ? 'Hide Order Details ↑'
                            : 'View Order Details ↓'}

                        </button>

                        <button
                          className="so-primary"
                          onClick={() =>
                            navigate('/products')
                          }
                        >

                          Shop Again

                        </button>

                      </div>

                      {/* EXPANDED ORDER DETAILS */}

                      {isExpanded && (

                        <div className="so-details">

                          <h3>Order Information</h3>

                          <div className="so-detail">

                            <span>Full Order ID</span>

                            <strong>{order._id}</strong>

                          </div>

                          <div className="so-detail">

                            <span>Transaction ID</span>

                            <strong>

                              {order.transactionId ||
                                'Not available'}

                            </strong>

                          </div>

                          <div className="so-detail">

                            <span>Payment Method</span>

                            <strong>

                              {order.paymentMethod === 'DEMO_UPI'
                                ? 'Demo UPI'
                                : order.paymentMethod ||
                                  'Not available'}

                            </strong>

                          </div>

                          <div className="so-detail">

                            <span>Order Date</span>

                            <strong>

                              {formatDate(order.createdAt)}

                            </strong>

                          </div>

                          <div className="so-detail">

                            <span>Total Amount</span>

                            <strong>

                              {rupee(order.totalAmount)}

                            </strong>

                          </div>

                          {isDemo && (

                            <p className="so-demo-note">

                              This is a demonstration order.
                              No real money was charged.

                            </p>

                          )}

                        </div>

                      )}

                    </article>

                  );

                })}

              </div>

            )}

          </>

        )}

        <footer className="so-footer">

          © {new Date().getFullYear()} ShopEasy.
          Premium Shopping Experience.

        </footer>

      </div>

    </main>

  );

}
