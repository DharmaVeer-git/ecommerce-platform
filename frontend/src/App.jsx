
import './index.css';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function PublicRoute({ children }) {
  return localStorage.getItem('token')
    ? <Navigate to="/products" replace />
    : children;
}

function PrivateRoute({ children }) {
  return localStorage.getItem('token')
    ? children
    : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const location = useLocation();

  const isAdminPage =
    location.pathname === '/admin' ||
    location.pathname.startsWith('/admin/');

  return (
    <>
      {!isAdminPage && <Navbar />}

      <Routes>

        <Route
          path="/"
          element={<Navigate to="/products" replace />}
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/products"
          element={<Products />}
        />

        <Route
          path="/cart"
          element={
            <PrivateRoute>
              <Cart />
            </PrivateRoute>
          }
        />

        <Route
          path="/checkout"
          element={
            <PrivateRoute>
              <Checkout />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin"
          element={<AdminLogin />}
        />

        <Route
          path="/admin/dashboard"
          element={<AdminDashboard />}
        />

        <Route
          path="*"
          element={<Navigate to="/products" replace />}
        />

      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
