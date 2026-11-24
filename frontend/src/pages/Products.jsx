
import { useEffect, useState, lazy, Suspense, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, addToCart } from '../api';
import './Products3D.css';

const ProductViewer = lazy(() => import('./ProductViewer'));

// Existing local 3D models
const models = [
  ['headphone', 'over-ear-headphones.glb'],
  ['watch', 'smartwatch.glb'],
  ['shoe', 'shoe.glb'],
  ['sunglass', 'SunglassesKhronos.glb'],
  ['speaker', 'cylindrical-wireless-speaker.glb'],
  ['backpack', 'hiking-backpack.glb']
];

// Support Cloudinary and existing local 3D models
const model = p => {
  if (p.modelUrl) return p.modelUrl;

  if (p.model3d) return p.model3d;

  const match = models.find(([k]) =>
    (p.name || '').toLowerCase().includes(k)
  );

  return match ? `/models/${match[1]}` : '';
};

// Dynamic product categories
const category = p => {
  if (p.category && p.category !== 'General') {
    return p.category;
  }

  return /headphone|speaker|watch/i.test(p.name)
    ? 'Tech'
    : /shoe/i.test(p.name)
      ? 'Footwear'
      : 'Accessories';
};

// Format product price
const money = p =>
  p.price != null && Number.isFinite(Number(p.price))
    ? `₹${Number(p.price).toLocaleString('en-IN')}`
    : 'Price unavailable';

// Product image
function Photo({ p, eager = false }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [p.image]);

  return p.image && !failed ? (
    <img
      src={p.image}
      alt={p.name}
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="se-placeholder">
      {p.name}
    </span>
  );
}

// Product details and interactive 3D viewer
function Details({ p, close, add, busy }) {
  const dialog = useRef(null);

  useEffect(() => {
    const d = dialog.current;

    d.showModal();

    return () => d.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="se-dialog"
      onCancel={e => {
        e.preventDefault();
        close();
      }}
      onClick={e => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="se-detail">

        <button
          className="se-close"
          onClick={close}
          aria-label="Close product details"
        >
          ×
        </button>

        <div className="se-view">

          <Suspense
            fallback={<p>Loading interactive viewer…</p>}
          >
            <ProductViewer
              image={p.image}
              images360={p.images360}
              model3d={model(p)}
              name={p.name}
            />
          </Suspense>

        </div>

        <div className="se-detail-copy">

          <span className="se-kicker">
            {category(p)} / Product details
          </span>

          <h2>{p.name}</h2>

          {p.brand && (
            <span className="se-kicker">
              Brand: {p.brand}
            </span>
          )}

          <p>{p.description}</p>

          <strong>{money(p)}</strong>

          <button
            className="se-primary"
            disabled={busy}
            onClick={() => add(p)}
          >
            {busy ? 'Adding…' : 'Add to bag'}
          </button>

          <Link to="/cart">
            View shopping bag →
          </Link>

        </div>

      </div>
    </dialog>
  );
}

// Main products page
export default function Products() {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('featured');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  const navigate = useNavigate();
  const lock = useRef(false);

  // Fetch products from backend
  useEffect(() => {
    let active = true;

    setLoading(true);
    setError('');

    getProducts()
      .then(r => {

        const list = Array.isArray(r.data)
          ? r.data
          : r.data?.products;

        if (!Array.isArray(list)) {
          throw Error('Unexpected product response');
        }

        if (active) {
          setProducts(
            list.filter(p => p.isActive !== false)
          );
        }

      })
      .catch(() => {

        if (active) {
          setError(
            'Could not load the collection. Please try again.'
          );
        }

      })
      .finally(() => {

        if (active) {
          setLoading(false);
        }

      });

    return () => {
      active = false;
    };

  }, [retry]);

  // Automatically dismiss notification
  useEffect(() => {
    if (!notice) return;

    const t = setTimeout(
      () => setNotice(''),
      5000
    );

    return () => clearTimeout(t);

  }, [notice]);

  // Add product to shopping cart
  async function add(p) {

    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    if (lock.current) return;

    const productId = p._id || p.id;

    if (!productId) {
      setNotice('Product unavailable.');
      return;
    }

    lock.current = true;
    setBusy(true);

    try {

      await addToCart(
        {
          productId,
          quantity: 1
        },
        token
      );

      setNotice(
        `${p.name} added to your bag.`
      );

    } catch (e) {

      setNotice(
        e.response?.data?.message ||
        'Could not add product. Please try again.'
      );

    } finally {

      lock.current = false;
      setBusy(false);

    }
  }

  // Automatically generate categories
  const categories = [
    'All',
    ...new Set(
      products.map(category).filter(c => c !== 'All')
    )
  ];

  // Reset filter if a category no longer exists
  useEffect(() => {
    if (
      !loading &&
      filter !== 'All' &&
      !products.some(p => category(p) === filter)
    ) {
      setFilter('All');
    }
  }, [products, filter, loading]);

  // Search, filter and sort products
  const visible = products
    .filter(p =>
      (filter === 'All' || category(p) === filter) &&
      `${p.name} ${p.description || ''} ${p.brand || ''} ${category(p)}`
        .toLowerCase()
        .includes(query.toLowerCase().trim())
    )
    .sort((a, b) =>
      sort === 'low'
        ? Number(a.price) - Number(b.price)
        : sort === 'high'
          ? Number(b.price) - Number(a.price)
          : 0
    );

  const featured =
    products.find(p => /headphone/i.test(p.name)) ||
    products[0];

  return (
    <main className="se-store">

      <div className="se-shell">

        {/* HERO SECTION */}

        <section className="se-hero">

          <div className="se-copy">

            <span className="se-kicker">
              SHOPEASY / THE COLLECTION
            </span>

            <h1>
              Everyday essentials.
              <br />
              <em>Extraordinary perspective.</em>
            </h1>

            <p>
              Discover thoughtfully selected technology
              and lifestyle accessories. Get closer to
              every detail with interactive 3D.
            </p>

            <a
              className="se-primary"
              href="#collection"
            >
              Explore collection ↗
            </a>

          </div>

          {featured && (
            <button
              className="se-feature"
              onClick={() => setSelected(featured)}
            >

              <Photo
                key={featured._id || featured.name}
                p={featured}
                eager
              />

              <span>
                FEATURED / {featured.name} <b>↗</b>
              </span>

            </button>
          )}

        </section>

        {/* BENEFITS SECTION */}

        <section className="se-benefits">

          <span>
            01 / Discover your favourites
          </span>

          <span>
            02 / Explore in interactive 3D
          </span>

          <span>
            03 / Shop with your account
          </span>

        </section>

        {/* PRODUCT COLLECTION */}

        <section
          id="collection"
          className="se-collection"
        >

          <div className="se-heading">

            <div>

              <span className="se-kicker">
                THE EDIT
              </span>

              <h2>
                Find your next favourite.
              </h2>

            </div>

            <span>
              {visible.length} products
            </span>

          </div>

          {/* SEARCH AND FILTERS */}

          <div className="se-tools">

            <div className="se-filters">

              {categories.map(c => (

                <button
                  key={c}
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                >
                  {c}
                </button>

              ))}

            </div>

            <input
              aria-label="Search products"
              placeholder="Search products…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

            <select
              aria-label="Sort products"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >

              <option value="featured">
                Featured
              </option>

              <option value="low">
                Price: low to high
              </option>

              <option value="high">
                Price: high to low
              </option>

            </select>

          </div>

          {/* LOADING STATE */}

          {loading ? (

            <div className="se-grid">

              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="se-skeleton"
                />
              ))}

            </div>

          ) : error ? (

            <div className="se-empty">

              {error}

              <button
                onClick={() => setRetry(x => x + 1)}
              >
                Retry
              </button>

            </div>

          ) : !visible.length ? (

            <div className="se-empty">

              No matching products.

              <button
                onClick={() => {
                  setQuery('');
                  setFilter('All');
                }}
              >
                Clear filters
              </button>

            </div>

          ) : (

            <div className="se-grid">

              {visible.map(p => (

                <article
                  className="se-card"
                  key={p._id || p.id || p.name}
                >

                  <button
                    className="se-photo"
                    onClick={() => setSelected(p)}
                  >

                    <Photo p={p} />

                    {model(p) && (
                      <span>
                        Explore in 3D ↗
                      </span>
                    )}

                  </button>

                  <div className="se-card-copy">

                    <span className="se-kicker">
                      {category(p)}
                    </span>

                    <button
                      className="se-name"
                      onClick={() => setSelected(p)}
                    >
                      {p.name}
                    </button>

                    <p>{p.description}</p>

                    <div className="se-card-bottom">

                      <strong>
                        {money(p)}
                      </strong>

                      <button
                        className="se-add"
                        disabled={busy}
                        onClick={() => add(p)}
                      >
                        Add to bag +
                      </button>

                    </div>

                  </div>

                </article>

              ))}

            </div>

          )}

        </section>

        {/* FOOTER */}

        <footer className="se-footer">

          <b>ShopEasy.</b>

          <span>
            Discover. Experience. Enjoy.
          </span>

          <Link to="/cart">
            Shopping bag →
          </Link>

        </footer>

      </div>

      {/* PRODUCT DETAILS MODAL */}

      {selected && (

        <Details
          key={selected._id || selected.name}
          p={selected}
          close={() => setSelected(null)}
          add={add}
          busy={busy}
        />

      )}

      {/* CART NOTIFICATION */}

      {notice && (

        <div
          className="se-toast"
          role="status"
        >

          {notice}

          <Link to="/cart">
            View bag
          </Link>

        </div>

      )}

    </main>
  );
}

