import {
  useEffect,
  useState,
  useRef,
  lazy,
  Suspense
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  verifyAdmin,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct
} from '../api';

import './Admin.css';

const ProductViewer = lazy(() => import('./ProductViewer'));

const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Accessories'
];

function normalizeCategory(value) {

  const category = String(value || '')
    .trim()
    .toLowerCase();

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

  return Object.prototype.hasOwnProperty.call(
    aliases, category
  ) ? aliases[category] : '';
}

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: '',
  brand: '',
  isActive: true
};

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Independent administrator session
  const token = localStorage.getItem('adminToken');

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState(null);

  const [image, setImage] = useState(null);
  const [model, setModel] = useState(null);

  const [imagePreview, setImagePreview] = useState('');
  const [modelPreview, setModelPreview] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const imageInput = useRef(null);
  const modelInput = useRef(null);
  const formPanel = useRef(null);
  const savingLock = useRef(false);

  // ================= ADMIN AUTHENTICATION =================

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        if (!token) {
          navigate('/admin', { replace: true });
          return;
        }

        await verifyAdmin(token);

        const response = await getAdminProducts(token);

        if (active) {
          setProducts(
            Array.isArray(response.data)
              ? response.data
              : []
          );

          setAuthorized(true);
        }

      } catch (err) {
        if (!active) return;

        const status = err.response?.status;

        if (status === 401 || status === 403) {
          localStorage.removeItem('adminToken');

          navigate('/admin', {
            replace: true
          });

          return;
        }

        setError(
          err.response?.data?.message ||
          'Unable to access admin dashboard.'
        );

      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };

  }, [token, navigate]);

  // ================= IMAGE PREVIEW =================

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return;
    }

    const url = URL.createObjectURL(image);

    setImagePreview(url);

    return () => URL.revokeObjectURL(url);

  }, [image]);

  // ================= 3D MODEL PREVIEW =================

  useEffect(() => {
    if (!model) {
      setModelPreview('');
      return;
    }

    const url = URL.createObjectURL(model);

    setModelPreview(url);

    return () => URL.revokeObjectURL(url);

  }, [model]);

  // ================= ADMIN LOGOUT =================

  function logout() {
    localStorage.removeItem('adminToken');

    navigate('/admin', {
      replace: true
    });
  }

  // ================= ERROR HANDLING =================

  function handleApiError(err, fallback) {
    const status = err.response?.status;

    if (status === 401 || status === 403) {
      logout();
      return;
    }

    setError(
      err.response?.data?.message ||
      fallback
    );
  }

  // ================= FORM HANDLING =================

  function changeField(e) {
    const { name, value, checked, type } = e.target;

    setForm(previous => ({
      ...previous,
      [name]: type === 'checkbox'
        ? checked
        : value
    }));
  }

  // ================= FILE VALIDATION =================

  function chooseFile(file, type) {
    if (!file || savingLock.current) return;

    setError('');

    if (file.size > 10 * 1024 * 1024) {
      setError('Maximum file size is 10 MB.');

      if (type === 'image' && imageInput.current) {
        imageInput.current.value = '';
      }

      if (type === 'model' && modelInput.current) {
        modelInput.current.value = '';
      }

      return;
    }

    if (type === 'image') {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        setError('Choose a JPG, PNG or WEBP image.');

        if (imageInput.current) {
          imageInput.current.value = '';
        }

        return;
      }

      setImage(file);
    }

    if (type === 'model') {
      if (!/\.glb$/i.test(file.name)) {
        setError('Choose a valid GLB model.');

        if (modelInput.current) {
          modelInput.current.value = '';
        }

        return;
      }

      setModel(file);
    }
  }

  // ================= REFRESH PRODUCTS =================

  async function refreshProducts() {
    const response = await getAdminProducts(token);

    setProducts(
      Array.isArray(response.data)
        ? response.data
        : []
    );
  }

  // ================= RESET FORM =================

  function resetForm() {
    setForm({ ...emptyForm });
    setEditing(null);
    setImage(null);
    setModel(null);
    setImagePreview('');
    setModelPreview('');

    if (imageInput.current) {
      imageInput.current.value = '';
    }

    if (modelInput.current) {
      modelInput.current.value = '';
    }
  }

  // ================= CREATE / UPDATE PRODUCT =================

  async function handleSubmit(e) {
    e.preventDefault();

    if (savingLock.current) return;

    setError('');
    setMessage('');

    if (!form.name.trim()) {
      setError('Please enter a product name.');
      return;
    }

    if (
      form.price === '' ||
      !Number.isFinite(Number(form.price)) ||
      Number(form.price) <= 0
    ) {
      setError('Please enter a valid product price above zero.');
      return;
    }

    if (
      form.stock === '' ||
      !Number.isSafeInteger(Number(form.stock)) ||
      Number(form.stock) < 0
    ) {
      setError('Stock must be a non-negative whole number.');
      return;
    }

    if (!PRODUCT_CATEGORIES.includes(form.category)) {

      setError('Please select a valid product category.');

      return;

    }

    if (!editing && !image) {
      setError('Please upload a product image.');
      return;
    }

    try {
      savingLock.current = true;
      setSaving(true);

      const data = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        data.append(key, String(value));
      });

      if (image) {
        data.append('image', image);
      }

      if (model) {
        data.append('model', model);
      }

      if (editing) {
        await updateAdminProduct(
          editing._id,
          data,
          token
        );

      } else {
        await createAdminProduct(
          data,
          token
        );
      }

      setMessage(
        editing
          ? 'Product updated successfully.'
          : 'Product created successfully.'
      );

      resetForm();

      try {
        await refreshProducts();

      } catch (err) {
        handleApiError(
          err,
          'Product saved, but the list could not refresh.'
        );
      }

    } catch (err) {
      handleApiError(
        err,
        'Unable to save product.'
      );

    } finally {
      setSaving(false);
      savingLock.current = false;
    }
  }

  // ================= EDIT PRODUCT =================

  function editProduct(product) {
    if (savingLock.current) return;

    setEditing(product);
    setImage(null);
    setModel(null);
    setImagePreview('');
    setModelPreview('');
    setError('');
    setMessage('');

    if (imageInput.current) {
      imageInput.current.value = '';
    }

    if (modelInput.current) {
      modelInput.current.value = '';
    }

    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      stock: product.stock ?? 0,
      category: normalizeCategory(product.category),
      brand: product.brand || '',
      isActive: product.isActive !== false
    });

    formPanel.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  // ================= HIDE PRODUCT =================

  async function removeProduct(product) {
    if (savingLock.current) return;

    if (
      !window.confirm(
        `Hide "${product.name}" from the website?`
      )
    ) {
      return;
    }

    setError('');
    setMessage('');
    setSaving(true);
    savingLock.current = true;

    try {
      await deleteAdminProduct(
        product._id,
        token
      );

      setMessage(
        'Product removed from storefront.'
      );

      if (editing?._id === product._id) {
        resetForm();
      }

      await refreshProducts();

    } catch (err) {
      handleApiError(
        err,
        'Unable to remove product or refresh the list.'
      );

    } finally {
      setSaving(false);
      savingLock.current = false;
    }
  }

  // ================= LOADING SCREEN =================

  if (loading) {
    return (
      <div className="admin-login-page">

        <div className="admin-login-card">

          <div className="admin-shield">
            🛡️
          </div>

          <h1>ShopEasy Admin</h1>

          <p>
            Verifying administrator access...
          </p>

        </div>

      </div>
    );
  }

  // ================= ACCESS DENIED =================

  if (!authorized) {
    return (
      <div className="admin-login-page">

        <div className="admin-login-card">

          <div className="admin-shield">
            🔒
          </div>

          <h1>Dashboard Unavailable</h1>

          <p>
            {error || 'Administrator access required.'}
          </p>

          <button
            className="admin-primary-btn"
            onClick={logout}
          >
            Return to Admin Login
          </button>

          <button
            className="admin-secondary-btn"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>

        </div>

      </div>
    );
  }

  // ================= PRODUCT SEARCH =================

  const visibleProducts = products.filter(product =>
    `${product.name || ''} ${product.category || ''} ${product.brand || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  const liveProducts = products.filter(
    product => product.isActive !== false
  ).length;

  const uploadedModels = products.filter(
    product => product.modelUrl
  ).length;

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stock || 0),
    0
  );

  // ================= ADMIN DASHBOARD =================

  return (
    <div className="admin-dashboard">

      {/* DASHBOARD HEADER */}

      <div className="ad-header">

        <div>

          <span className="admin-tag">
            OWNER CONTROL PANEL
          </span>

          <h1>ShopEasy Admin</h1>

          <p>
            Manage your entire product collection.
          </p>

        </div>

        <div className="ad-actions">

          <button
            type="button"
            onClick={() => navigate('/products')}
          >
            View Store
          </button>

          <button
            type="button"
            onClick={logout}
          >
            Logout
          </button>

        </div>

      </div>

      {/* INVENTORY STATISTICS */}

      <div className="ad-stats">

        <div className="ad-stat">

          <span>Total Products</span>

          <h2>{products.length}</h2>

        </div>

        <div className="ad-stat">

          <span>Live Products</span>

          <h2>{liveProducts}</h2>

        </div>

        <div className="ad-stat">

          <span>Uploaded 3D Models</span>

          <h2>{uploadedModels}</h2>

        </div>

        <div className="ad-stat">

          <span>Total Stock</span>

          <h2>{totalStock}</h2>

        </div>

      </div>

      {/* SUCCESS AND ERROR MESSAGES */}

      {message && (
        <div
          className="ad-success"
          role="status"
        >
          {message}
        </div>
      )}

      {error && (
        <div
          className="admin-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* PRODUCT CREATION AND EDITING */}

      <div
        className="ad-panel"
        ref={formPanel}
      >

        <h2>
          {editing
            ? 'Edit Product'
            : 'Add New Product'}
        </h2>

        <form onSubmit={handleSubmit}>

          <fieldset
            disabled={saving}
            className="ad-fieldset"
          >

            <div className="ad-form-grid">

              <label>

                Product Name

                <input
                  name="name"
                  value={form.name}
                  onChange={changeField}
                  placeholder="Premium Wireless Headphones"
                  required
                />

              </label>

              <label>

                Brand

                <input
                  name="brand"
                  value={form.brand}
                  onChange={changeField}
                  placeholder="Brand name"
                />

              </label>

              <label>

                Price (INR)

                <input
                  type="number"
                  name="price"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={changeField}
                  placeholder="Enter price"
                  required
                />

              </label>

              <label>

                Stock Quantity

                <input
                  type="number"
                  name="stock"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={changeField}
                  placeholder="Enter stock quantity"
                  required
                />

              </label>

              <label>

                Product Category *

                <select
                  name="category"
                  value={form.category}
                  onChange={changeField}
                  required
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    background: '#181e2e',
                    color: '#f5f6fb',
                    border: '1px solid #343b4e',
                    borderRadius: '10px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >

                  <option value="">
                    Select Product Category
                  </option>

                  {PRODUCT_CATEGORIES.map(category => (

                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>

                  ))}

                </select>

                {form.category && (

                  <small style={{
                    display: 'block',
                    color: '#86efac',
                    marginTop: '8px'
                  }}>

                    {form.isActive
                      ? `Visible in All Products and ${form.category} after publishing.`
                      : 'Product will remain hidden until published.'}

                  </small>

                )}

              </label>

              <label className="ad-checkbox">

                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={changeField}
                />

                Publish on live website

              </label>

              <label className="ad-full">

                Product Description

                <textarea
                  name="description"
                  rows="5"
                  value={form.description}
                  onChange={changeField}
                  placeholder="Enter product features and specifications..."
                />

              </label>

            </div>

            {/* IMAGE AND 3D MODEL UPLOAD */}

            <div className="ad-upload-grid">

              {/* IMAGE UPLOAD */}

              <div
                className="ad-upload"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();

                  if (!saving) {
                    chooseFile(
                      e.dataTransfer.files[0],
                      'image'
                    );
                  }
                }}
              >

                <h3>Product Image</h3>

                {(imagePreview || editing?.image) && (

                  <img
                    className="ad-preview-image"
                    src={imagePreview || editing?.image}
                    alt="Product preview"
                  />

                )}

                <p>
                  Drag and drop or choose an image
                </p>

                <input
                  ref={imageInput}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={e =>
                    chooseFile(
                      e.target.files[0],
                      'image'
                    )
                  }
                />

                <small>
                  JPG, PNG, WEBP — Max 10 MB
                </small>

                {image && (
                  <small>
                    Selected: {image.name}
                  </small>
                )}

              </div>

              {/* 3D MODEL UPLOAD */}

              <div
                className="ad-upload"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();

                  if (!saving) {
                    chooseFile(
                      e.dataTransfer.files[0],
                      'model'
                    );
                  }
                }}
              >

                <h3>3D Product Model</h3>

                {(modelPreview || editing?.modelUrl) && (

                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '320px',
                      overflow: 'hidden',
                      borderRadius: '12px'
                    }}
                  >

                    <Suspense
                      fallback={
                        <p>Loading 3D preview...</p>
                      }
                    >

                      <ProductViewer
                        key={
                          modelPreview ||
                          editing?.modelUrl
                        }
                        image={
                          imagePreview ||
                          editing?.image
                        }
                        model3d={
                          modelPreview ||
                          editing?.modelUrl
                        }
                        name={
                          form.name ||
                          'Product preview'
                        }
                      />

                    </Suspense>

                  </div>

                )}

                <p>
                  Drag and drop or choose a GLB file
                </p>

                <input
                  ref={modelInput}
                  type="file"
                  accept=".glb"
                  onChange={e =>
                    chooseFile(
                      e.target.files[0],
                      'model'
                    )
                  }
                />

                <small>
                  GLB format — Max 10 MB
                </small>

                {model && (
                  <small>
                    Selected: {model.name}
                  </small>
                )}

              </div>

            </div>

            {/* SAVE PRODUCT BUTTON */}

            <button
              type="submit"
              className="admin-primary-btn"
              disabled={saving}
            >

              {saving
                ? 'Saving product... Please wait'
                : editing
                  ? 'Save Product Changes'
                  : form.isActive
                    ? '+ Publish Product'
                    : '+ Save Hidden Product'}

            </button>

            {editing && (

              <button
                type="button"
                className="admin-secondary-btn"
                onClick={resetForm}
                disabled={saving}
              >
                Cancel Editing
              </button>

            )}

          </fieldset>

        </form>

      </div>

      {/* MANAGE PRODUCTS */}

      <div className="ad-panel">

        <div className="ad-list-header">

          <h2>Manage Products</h2>

          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

        </div>

        <div className="ad-table-wrap">

          <table className="ad-table">

            <thead>

              <tr>

                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>3D Model</th>
                <th>Status</th>
                <th>Actions</th>

              </tr>

            </thead>

            <tbody>

              {visibleProducts.map(product => (

                <tr key={product._id}>

                  <td>

                    <div className="ad-product">

                      {product.image && (

                        <img
                          src={product.image}
                          alt={product.name || 'Product'}
                          loading="lazy"
                        />

                      )}

                      <span>
                        {product.name}
                      </span>

                    </div>

                  </td>

                  <td>
                    {normalizeCategory(product.category) || product.category || 'General'}
                  </td>

                  <td>

                    ₹{Number(
                      product.price || 0
                    ).toLocaleString('en-IN')}

                  </td>

                  <td>
                    {product.stock ?? 0}
                  </td>

                  <td>

                    {product.modelUrl
                      ? 'Available'
                      : 'Not uploaded'}

                  </td>

                  <td>

                    <span
                      className={
                        product.isActive !== false
                          ? 'ad-live'
                          : 'ad-hidden'
                      }
                    >

                      {product.isActive !== false
                        ? 'Live'
                        : 'Hidden'}

                    </span>

                  </td>

                  <td>

                    <div className="ad-row-actions">

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          editProduct(product)
                        }
                      >
                        Edit
                      </button>

                      {product.isActive !== false && (

                        <button
                          type="button"
                          className="ad-delete"
                          disabled={saving}
                          onClick={() =>
                            removeProduct(product)
                          }
                        >
                          Hide
                        </button>

                      )}

                    </div>

                  </td>

                </tr>

              ))}

              {!visibleProducts.length && (

                <tr>

                  <td colSpan="7">
                    No products found.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}