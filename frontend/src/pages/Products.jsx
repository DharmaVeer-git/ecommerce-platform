
import {
  useEffect,
  useState,
  lazy,
  Suspense,
  useRef
} from 'react';

import {
  Link,
  useNavigate,
  useSearchParams
} from 'react-router-dom';

import {
  getProducts,
  addToCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist
} from '../api';

import VoiceSearch from '../components/VoiceSearch';

import './Products3D.css';

const ProductViewer = lazy(() => import('./ProductViewer'));

// ==========================================
// EXISTING LOCAL 3D MODELS
// ==========================================

const models = [
  ['headphone', 'over-ear-headphones.glb'],
  ['watch', 'smartwatch.glb'],
  ['shoe', 'shoe.glb'],
  ['sunglass', 'SunglassesKhronos.glb'],
  ['speaker', 'cylindrical-wireless-speaker.glb'],
  ['backpack', 'hiking-backpack.glb']
];

// ==========================================
// SUPPORT CLOUDINARY AND LOCAL 3D MODELS
// ==========================================

const model = p => {
  if (p.modelUrl) return p.modelUrl;

  if (p.model3d) return p.model3d;

  const match = models.find(([k]) =>
    (p.name || '').toLowerCase().includes(k)
  );

  return match ? `/models/${match[1]}` : '';
};

// ==========================================
// DYNAMIC PRODUCT CATEGORIES
// ==========================================

const category = p => {

  const raw = String(p.category || '').trim();

  const normalized = raw.toLowerCase();

  const aliases = {
    electronics: 'Electronics',
    tech: 'Electronics',
    technology: 'Electronics',
    fashion: 'Fashion',
    footwear: 'Fashion',
    clothing: 'Fashion',
    accessories: 'Accessories',
    accessory: 'Accessories'
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  if (raw && normalized !== 'general') {
    return raw;
  }

  if (/headphone|speaker|watch|earphone|mobile|laptop/i.test(p.name)) {
    return 'Electronics';
  }

  if (/shoe|sunglass|shirt|clothing|sneaker/i.test(p.name)) {
    return 'Fashion';
  }

  return 'Accessories';
};

// ==========================================
// FORMAT PRODUCT PRICE
// ==========================================

const money = p =>
  p.price != null && Number.isFinite(Number(p.price))
    ? `₹${Number(p.price).toLocaleString('en-IN')}`
    : 'Price unavailable';

// ==========================================
// SMART SEARCH NORMALIZATION
// ==========================================

const normalize = text =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stopWords = new Set([
  'i',
  'want',
  'to',
  'buy',
  'show',
  'me',
  'find',
  'search',
  'for',
  'please',
  'a',
  'an',
  'the',
  'some',
  'looking',
  'am',
  'need',
  'can',
  'you',
  'get',
  'would',
  'like',
  'purchase',
  'could',
  'my'
]);

const searchAliases = {
  earphones: 'headphones',
  headset: 'headphones',
  headsets: 'headphones',
  sneakers: 'shoes',
  spectacles: 'sunglasses',
  rucksack: 'backpack',
  rucksacks: 'backpack'
};

function matchesProduct(p, query) {

  const searchWords = normalize(query)
    .split(/\s+/)
    .filter(word => word && !stopWords.has(word))
    .map(word => searchAliases[word] || word);

  const searchableText = normalize(
    `${p.name || ''}
     ${p.description || ''}
     ${p.brand || ''}
     ${category(p)}`
  );

  const compactText = searchableText.replace(/\s/g, '');

  return searchWords.every(word => {

    const singular =
      word.length > 3
        ? word.replace(/s$/, '')
        : word;

    return (
      compactText.includes(word) ||
      compactText.includes(singular)
    );

  });
}

// ==========================================
// PRODUCT IMAGE
// ==========================================

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

// ==========================================
// PRODUCT DETAILS AND INTERACTIVE 3D VIEWER
// ==========================================

function Details({
  p,
  close,
  add,
  busy,
  saved,
  toggleWishlist,
  wishlistDisabled
}) {

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
        if (e.target === dialog.current) {
          close();
        }
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
            fallback={
              <p>Loading interactive viewer…</p>
            }
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

          {/* WISHLIST BUTTON INSIDE PRODUCT DETAILS */}

          <button
            type="button"
            disabled={wishlistDisabled}
            aria-pressed={saved}
            onClick={() => toggleWishlist(p)}
            style={{
              padding: '13px 18px',
              borderRadius: '10px',
              border: '1px solid #f472b680',
              background: saved
                ? '#321c35'
                : '#ffffff06',
              color: '#f472b6',
              fontWeight: '600',
              cursor: wishlistDisabled
                ? 'not-allowed'
                : 'pointer',
              opacity: wishlistDisabled ? 0.6 : 1
            }}
          >

            {saved
              ? '♥ Remove from Wishlist'
              : '♡ Save to Wishlist'}

          </button>

          <Link to="/wishlist">
            View my wishlist →
          </Link>

          <Link to="/cart">
            View shopping bag →
          </Link>

        </div>

      </div>

    </dialog>

  );
}

// ==========================================
// MAIN PRODUCTS PAGE
// ==========================================

export default function Products() {

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const filter = searchParams.get('category') || 'All';

  function setFilter(value) {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);

      if (value === 'All') {
        next.delete('category');
      } else {
        next.set('category', value);
      }

      return next;
    });
  }

  useEffect(() => {
    if (filter !== 'All') {
      setQuery('');

      document
        .getElementById('collection')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
    }
  }, [filter]);
  const [sort, setSort] = useState('featured');

  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);

  const navigate = useNavigate();
  const lock = useRef(false);

  // ========================================
  // CUSTOMER WISHLIST STATE
  // ========================================

  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [wishlistNotice, setWishlistNotice] = useState('');
  const [wishlistReady, setWishlistReady] = useState(false);
  const [wishlistRetry, setWishlistRetry] = useState(0);
  const [wishlistOwner, setWishlistOwner] = useState(null);

  const wishlistLock = useRef(false);

  const wishlistToken = localStorage.getItem('token');

  const wishlistAvailable =
    wishlistReady &&
    wishlistOwner === wishlistToken;

  const wishlistDisabled =
    wishlistBusy ||
    (!!wishlistToken && !wishlistAvailable);

  function isSaved(product) {

    const productId = product._id || product.id;

    return (
      wishlistAvailable &&
      wishlistIds.includes(String(productId))
    );

  }

  // ========================================
  // FETCH CUSTOMER WISHLIST FROM MONGODB
  // ========================================

  useEffect(() => {

    let active = true;

    setWishlistIds([]);
    setWishlistReady(false);
    setWishlistOwner(null);
    setWishlistNotice('');

    if (!wishlistToken) return;

    async function loadWishlist() {

      try {

        const res = await getWishlist(wishlistToken);

        if (!Array.isArray(res.data)) {
          throw new Error('Invalid wishlist response.');
        }

        if (
          active &&
          localStorage.getItem('token') === wishlistToken
        ) {

          setWishlistIds(
            res.data.map(product => String(product._id))
          );

          setWishlistOwner(wishlistToken);
          setWishlistReady(true);

        }

      } catch (err) {

        if (!active) return;

        setWishlistNotice(
          err.response?.status === 401
            ? 'Your session has expired. Please sign in again.'
            : 'Unable to load your saved favourites.'
        );

      }

    }

    loadWishlist();

    return () => {
      active = false;
    };

  }, [wishlistToken, wishlistRetry]);

  // ========================================
  // ADD OR REMOVE PRODUCT FROM WISHLIST
  // ========================================

  async function toggleWishlist(product) {

    const token = localStorage.getItem('token');

    if (!token) {

      navigate('/login');

      return;

    }

    if (
      wishlistLock.current ||
      !wishlistAvailable ||
      token !== wishlistOwner
    ) {
      return;
    }

    const id = product._id || product.id;

    if (!id) {

      setWishlistNotice('Product unavailable.');

      return;

    }

    const productId = String(id);

    const alreadySaved =
      wishlistIds.includes(productId);

    wishlistLock.current = true;

    setWishlistBusy(true);
    setWishlistNotice('');

    try {

      if (alreadySaved) {

        await removeFromWishlist(
          productId,
          token
        );

        if (localStorage.getItem('token') !== token) {
          return;
        }

        setWishlistIds(previous =>
          previous.filter(id => id !== productId)
        );

        setWishlistNotice(
          `${product.name} removed from wishlist.`
        );

      } else {

        await addToWishlist(
          productId,
          token
        );

        if (localStorage.getItem('token') !== token) {
          return;
        }

        setWishlistIds(previous => [
          ...new Set([...previous, productId])
        ]);

        setWishlistNotice(
          `${product.name} saved to wishlist.`
        );

      }

    } catch (err) {

      if (localStorage.getItem('token') !== token) {
        return;
      }

      if (err.response?.status === 401) {

        localStorage.removeItem('token');

        navigate('/login', { replace: true });

        return;

      }

      setWishlistNotice(
        err.response?.data?.message ||
        'Unable to update wishlist. Please try again.'
      );

    } finally {

      wishlistLock.current = false;

      setWishlistBusy(false);

    }

  }

  // ========================================
  // TEXT AND VOICE SEARCH HANDLER
  // ========================================

  function handleSearch(text) {

    setQuery(String(text || '').trim());
    setFilter('All');

    document
      .getElementById('collection')
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

  }

  function handleQueryChange(text) {

    setQuery(text);
    setFilter('All');

  }

  function clearSearch() {

    setQuery('');
    setFilter('All');

  }

  // ========================================
  // FETCH PRODUCTS FROM BACKEND
  // ========================================

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

  // ========================================
  // AUTOMATICALLY DISMISS CART NOTIFICATIONS
  // ========================================

  useEffect(() => {

    if (!notice) return;

    const t = setTimeout(
      () => setNotice(''),
      5000
    );

    return () => clearTimeout(t);

  }, [notice]);

  // ========================================
  // AUTOMATICALLY DISMISS WISHLIST NOTIFICATIONS
  // ========================================

  useEffect(() => {

    if (!wishlistNotice || !wishlistAvailable) {
      return;
    }

    const t = setTimeout(
      () => setWishlistNotice(''),
      5000
    );

    return () => clearTimeout(t);

  }, [wishlistNotice, wishlistAvailable]);

  // ========================================
  // ADD PRODUCT TO SHOPPING CART
  // ========================================

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

  // ========================================
  // AUTOMATICALLY GENERATE CATEGORIES
  // ========================================

  const categories = [
    'All',
    ...new Set(
      products
        .map(category)
        .concat(['Electronics', 'Fashion', 'Accessories'])
        .filter(c => c !== 'All')
    )
  ];

  // ========================================
  // RESET INVALID CATEGORY FILTER
  // ========================================



  // ========================================
  // SMART SEARCH, FILTER AND SORT
  // ========================================

  const visible = products
    .filter(p => {

      const matchesCategory =
        filter === 'All' ||
        category(p) === filter;

      const matchesSearch =
        matchesProduct(p, query);

      return matchesCategory && matchesSearch;

    })
    .sort((a, b) =>
      sort === 'low'
        ? Number(a.price) - Number(b.price)
        : sort === 'high'
          ? Number(b.price) - Number(a.price)
          : 0
    );

  const featured =
    products.find(p =>
      /headphone/i.test(p.name)
    ) || products[0];

  // ========================================
  // USER INTERFACE
  // ========================================

  return (

    <main className="se-store">

      <div className="se-shell">

        {/* VOICE ENABLED SMART SEARCH */}

        <VoiceSearch
          query={query}
          setQuery={handleQueryChange}
          onSearch={handleSearch}
        />

        {/* HERO SECTION */}

        <section className="se-hero">

          <div className="se-copy">

            <span className="se-kicker">
              SHOPEASY / THE COLLECTION
            </span>

            <h1>

              Everyday essentials.

              <br />

              <em>
                Extraordinary perspective.
              </em>

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

                {query.trim()
                  ? 'SEARCH RESULTS'
                  : 'THE EDIT'}

              </span>

              <h2>

                {query.trim()
                  ? 'Find your matching products.'
                  : filter !== 'All'
                    ? `${filter} Collection.`
                    : 'Find your next favourite.'}

              </h2>

            </div>

            <span>

              {visible.length}{' '}

              {visible.length === 1
                ? 'product'
                : 'products'}

            </span>

          </div>

          {/* CUSTOMER WISHLIST SHORTCUT */}

          {wishlistToken && wishlistAvailable && (

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: '18px'
              }}
            >

              <Link
                to="/wishlist"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#211d35',
                  color: '#e4dcff',
                  border: '1px solid #c1afff35',
                  padding: '10px 16px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >

                <span
                  style={{
                    color: '#f472b6',
                    fontSize: '20px'
                  }}
                >
                  ♥
                </span>

                My Wishlist ({wishlistIds.length})

              </Link>

            </div>

          )}

          {/* ACTIVE SEARCH INFORMATION */}

          {query.trim() && (

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '20px',
                padding: '15px 18px',
                border: '1px solid #514478',
                borderRadius: '12px',
                background: '#181e2e'
              }}
            >

              <span
                style={{
                  color: '#c1afff',
                  fontSize: '14px',
                  overflowWrap: 'anywhere',
                  minWidth: 0
                }}
              >

                Showing results for: "{query}"

              </span>

              <button
                type="button"
                onClick={clearSearch}
                style={{
                  background: '#33274e',
                  color: '#e4dcff',
                  border: '1px solid #7466a7',
                  borderRadius: '8px',
                  padding: '8px 14px'
                }}
              >

                Clear search ×

              </button>

            </div>

          )}

          {/* CATEGORY FILTERS AND SORTING */}

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

            /* ERROR STATE */

            <div className="se-empty">

              {error}

              <button
                onClick={() => setRetry(x => x + 1)}
              >

                Retry

              </button>

            </div>

          ) : !visible.length ? (

            /* NO MATCHING PRODUCTS */

            <div className="se-empty">

              <h2>No matching products</h2>

              <p
                style={{
                  color: '#a7afc2',
                  marginTop: '12px'
                }}
              >

                {query.trim()
                  ? `We couldn't find products matching "${query}".`
                  : 'No products are available in this category.'}

              </p>

              <p
                style={{
                  color: '#a7afc2',
                  marginTop: '8px'
                }}
              >

                Try another product name or use voice search again.

              </p>

              <button onClick={clearSearch}>

                Clear filters

              </button>

            </div>

          ) : (

            /* PRODUCT GRID */

            <div className="se-grid">

              {visible.map(p => (

                <article
                  className="se-card"
                  key={p._id || p.id || p.name}
                >

                  {/* WISHLIST HEART BUTTON */}

                  <button
                    type="button"
                    className={
                      isSaved(p)
                        ? 'se-wishlist-heart saved'
                        : 'se-wishlist-heart'
                    }
                    disabled={wishlistDisabled}
                    aria-label={
                      isSaved(p)
                        ? `Remove ${p.name} from wishlist`
                        : `Save ${p.name} to wishlist`
                    }
                    aria-pressed={isSaved(p)}
                    title={
                      isSaved(p)
                        ? 'Remove from wishlist'
                        : 'Add to wishlist'
                    }
                    onClick={() => toggleWishlist(p)}
                  >

                    {isSaved(p) ? '♥' : '♡'}

                  </button>

                  {/* PRODUCT IMAGE */}

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

                  {/* PRODUCT INFORMATION */}

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

          <Link to="/wishlist">

            My Wishlist ♡

          </Link>

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
          saved={isSaved(selected)}
          toggleWishlist={toggleWishlist}
          wishlistDisabled={wishlistDisabled}
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

      {/* WISHLIST NOTIFICATION */}

      {wishlistNotice && (

        <div
          className="se-wishlist-toast"
          role="status"
        >

          <span>

            {wishlistNotice}

          </span>

          {wishlistToken && !wishlistAvailable ? (

            <>

              <button
                type="button"
                onClick={() =>
                  setWishlistRetry(x => x + 1)
                }
                style={{
                  fontSize: '13px',
                  color: '#c1afff'
                }}
              >

                Retry

              </button>

              <Link
                to="/login"
                onClick={() =>
                  localStorage.removeItem('token')
                }
              >

                Sign in again

              </Link>

            </>

          ) : (

            <Link to="/wishlist">

              View Wishlist

            </Link>

          )}

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setWishlistNotice('')}
          >

            ×

          </button>

        </div>

      )}

    </main>

  );

}
