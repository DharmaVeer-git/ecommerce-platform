
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
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

const emptyForm = {
  name: '',
  description: '',
  price: '',
  stock: '',
  category: 'Tech',
  brand: '',
  isActive: true
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
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
          setProducts(response.data);
          setAuthorized(true);
        }

      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
            'Unable to access admin dashboard.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [token, navigate]);

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return;
    }

    const url = URL.createObjectURL(image);
    setImagePreview(url);

    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (!model) {
      setModelPreview('');
      return;
    }

    const url = URL.createObjectURL(model);
    setModelPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [model]);

  function changeField(e) {
    const { name, value, checked, type } = e.target;

    setForm(previous => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function chooseFile(file, type) {
    if (!file) return;

    setError('');

    if (file.size > 10 * 1024 * 1024) {
      setError('Maximum file size is 10 MB.');
      return;
    }

    if (type === 'image') {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        setError('Choose a JPG, PNG or WEBP image.');
        return;
      }

      setImage(file);
    }

    if (type === 'model') {
      if (!/\.glb$/i.test(file.name)) {
        setError('Choose a valid GLB model.');
        return;
      }

      setModel(file);
    }
  }

  async function refreshProducts() {
    const response = await getAdminProducts(token);
    setProducts(response.data);
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setEditing(null);
    setImage(null);
    setModel(null);

    if (imageInput.current) imageInput.current.value = '';
    if (modelInput.current) modelInput.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (saving) return;

    setError('');
    setMessage('');

    if (!editing && !image) {
      setError('Please upload a product image.');
      return;
    }

    try {
      setSaving(true);

      const data = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        data.append(key, String(value));
      });

      if (image) data.append('image', image);
      if (model) data.append('model', model);

      if (editing) {
        await updateAdminProduct(editing._id, data, token);
      } else {
        await createAdminProduct(data, token);
      }

      setMessage(
        editing
          ? 'Product updated successfully.'
          : 'Product created successfully.'
      );

      resetForm();

      try {
        await refreshProducts();
      } catch {
        setError('Product saved, but the list could not refresh.');
      }

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to save product.'
      );
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product) {
    setEditing(product);
    setImage(null);
    setModel(null);
    setError('');
    setMessage('');

    if (imageInput.current) imageInput.current.value = '';
    if (modelInput.current) modelInput.current.value = '';

    setForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price ?? '',
      stock: product.stock ?? 0,
      category: product.category || 'Tech',
      brand: product.brand || '',
      isActive: product.isActive !== false
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async function removeProduct(product) {
    if (saving) return;

    if (!window.confirm(`Hide "${product.name}" from the website?`)) {
      return;
    }

    setError('');
    setMessage('');
    setSaving(true);

    try {
      await deleteAdminProduct(product._id, token);

      setMessage('Product removed from storefront.');

      if (editing?._id === product._id) resetForm();

      await refreshProducts();

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to remove product or refresh the list.'
      );
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    navigate('/login', { replace: true });
  }

  if (loading) {
    return (
      <div className="admin-login-page">
        <h2>Verifying administrator access...</h2>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <h1>Access Denied</h1>
          <p>{error || 'Administrator access required.'}</p>

          <button
            className="admin-primary-btn"
            onClick={() => navigate('/admin')}
          >
            Return to Admin Login
          </button>

          <button
            className="admin-secondary-btn"
            onClick={logout}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const visibleProducts = products.filter(p =>
    `${p.name} ${p.category} ${p.brand || ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <main className="admin-dashboard">

      <header className="ad-header">
        <div>
          <span className="admin-tag">OWNER CONTROL PANEL</span>
          <h1>ShopEasy Admin</h1>
          <p>Manage your entire product collection.</p>
        </div>

        <div className="ad-actions">
          <button onClick={() => navigate('/products')}>
            View Store
          </button>
          <button onClick={logout}>Logout</button>
        </div>
      </header>

      <section className="ad-stats">

        <div className="ad-stat">
          <span>Total Products</span>
          <h2>{products.length}</h2>
        </div>

        <div className="ad-stat">
          <span>Live Products</span>
          <h2>
            {products.filter(p => p.isActive !== false).length}
          </h2>
        </div>

        <div className="ad-stat">
          <span>Uploaded 3D Models</span>
          <h2>
            {products.filter(p => p.modelUrl).length}
          </h2>
        </div>

        <div className="ad-stat">
          <span>Total Stock</span>
          <h2>
            {products.reduce((sum, p) => sum + Number(p.stock || 0), 0)}
          </h2>
        </div>

      </section>

      {message && (
        <div className="ad-success" role="status">{message}</div>
      )}

      {error && (
        <div className="admin-error" role="alert">{error}</div>
      )}

      <section className="ad-panel">

        <h2>
          {editing ? 'Edit Product' : 'Add New Product'}
        </h2>

        <form onSubmit={handleSubmit}>

          <fieldset disabled={saving} className="ad-fieldset">

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
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={changeField}
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
                  required
                />
              </label>

              <label>
                Category
                <input
                  name="category"
                  list="admin-categories"
                  value={form.category}
                  onChange={changeField}
                  required
                />

                <datalist id="admin-categories">
                  <option value="Tech" />
                  <option value="Footwear" />
                  <option value="Accessories" />
                  <option value="Clothing" />
                  <option value="Home" />
                  <option value="Fitness" />
                  <option value="General" />
                </datalist>
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

            <div className="ad-upload-grid">

              <div
                className="ad-upload"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (!saving) chooseFile(e.dataTransfer.files[0], 'image');
                }}
              >
                <h3>Product Image</h3>

                {(imagePreview || editing?.image) && (
                  <img
                    className="ad-preview-image"
                    src={imagePreview || editing.image}
                    alt="Product preview"
                  />
                )}

                <p>Drag and drop or choose an image</p>

                <input
                  ref={imageInput}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={e => chooseFile(e.target.files[0], 'image')}
                />

                <small>JPG, PNG, WEBP — Max 10 MB</small>
              </div>

              <div
                className="ad-upload"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (!saving) chooseFile(e.dataTransfer.files[0], 'model');
                }}
              >
                <h3>3D Product Model</h3>

                {(modelPreview || editing?.modelUrl) && (
                  <Suspense fallback={<p>Loading 3D preview...</p>}>
                    <ProductViewer
                      key={modelPreview || editing?.modelUrl}
                      image={imagePreview || editing?.image}
                      model3d={modelPreview || editing?.modelUrl}
                      name={form.name || 'Product preview'}
                    />
                  </Suspense>
                )}

                <p>Drag and drop or choose a GLB file</p>

                <input
                  ref={modelInput}
                  type="file"
                  accept=".glb"
                  onChange={e => chooseFile(e.target.files[0], 'model')}
                />

                <small>GLB format — Max 10 MB</small>
              </div>

            </div>

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
              >
                Cancel Editing
              </button>
            )}

          </fieldset>

        </form>

      </section>

      <section className="ad-panel">

        <div className="ad-list-header">
          <h2>Manage Products</h2>

          <input
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
                        <img src={product.image} alt="" />
                      )}
                      <span>{product.name}</span>
                    </div>
                  </td>

                  <td>{product.category}</td>

                  <td>
                    ₹{Number(product.price).toLocaleString('en-IN')}
                  </td>

                  <td>{product.stock}</td>

                  <td>
                    {product.modelUrl ? 'Available' : 'Not uploaded'}
                  </td>

                  <td>
                    <span className={
                      product.isActive !== false
                        ? 'ad-live'
                        : 'ad-hidden'
                    }>
                      {product.isActive !== false ? 'Live' : 'Hidden'}
                    </span>
                  </td>

                  <td>
                    <div className="ad-row-actions">

                      <button
                        disabled={saving}
                        onClick={() => editProduct(product)}
                      >
                        Edit
                      </button>

                      {product.isActive !== false && (
                        <button
                          className="ad-delete"
                          disabled={saving}
                          onClick={() => removeProduct(product)}
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
                  <td colSpan="7">No products found.</td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

      </section>

    </main>
  );
}
