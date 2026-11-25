import axios from 'axios';

// ================= SERVICE URLS =================

// Authentication service
const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ||
  'https://auth-service-v2-6jie.onrender.com/api';

// Core service
const CORE_URL =
  import.meta.env.VITE_CORE_URL ||
  'https://core-service-duvc.onrender.com/api';

// Legacy payment service
const PAYMENT_URL =
  'https://payment-service-kl28.onrender.com/api';

// Admin service
const ADMIN_URL = CORE_URL;

// ================= AUTHENTICATION =================

export const signup = (data) =>
  axios.post(`${AUTH_URL}/auth/signup`, data);

export const login = (data) =>
  axios.post(`${AUTH_URL}/auth/login`, data);

// ================= OTP AUTHENTICATION =================

export const requestOTP = (data) =>
  axios.post(`${AUTH_URL}/auth/request-otp`, data);

export const verifyOTP = (data) =>
  axios.post(`${AUTH_URL}/auth/verify-otp`, data);

// ================= PRODUCTS =================

export const getProducts = () =>
  axios.get(`${CORE_URL}/products`);

// ================= CART =================

export const addToCart = (data, token) =>
  axios.post(`${CORE_URL}/cart/add`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

export const getCart = (token) =>
  axios.get(`${CORE_URL}/cart`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

// ================= DEMO ORDERS =================

export const placeOrder = (token, expectedAmount) =>
  axios.post(
    `${CORE_URL}/orders`,
    { expectedAmount },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

// Get customer order history
export const getOrders = (token) =>
  axios.get(`${CORE_URL}/orders`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

// ================= LEGACY PAYMENT =================

// Retained for compatibility.
// The updated demo checkout does not use this function.

export const makePayment = (data, token) =>
  axios.post(`${PAYMENT_URL}/payment/pay`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

// ================= ADMIN AUTHENTICATION =================

const adminHeaders = (token) => ({
  Authorization: `Bearer ${token}`
});

// Verify admin access
export const verifyAdmin = (token) =>
  axios.get(`${ADMIN_URL}/admin/verify`, {
    headers: adminHeaders(token)
  });

// ================= ADMIN PRODUCTS =================

// Get all products
export const getAdminProducts = (token) =>
  axios.get(`${ADMIN_URL}/admin/products`, {
    headers: adminHeaders(token)
  });

// Create product with image and GLB model
export const createAdminProduct = (data, token) =>
  axios.post(`${ADMIN_URL}/admin/products`, data, {
    headers: adminHeaders(token)
  });

// Update existing product
export const updateAdminProduct = (id, data, token) =>
  axios.put(
    `${ADMIN_URL}/admin/products/${id}`,
    data,
    {
      headers: adminHeaders(token)
    }
  );

// Hide product from storefront
export const deleteAdminProduct = (id, token) =>
  axios.delete(`${ADMIN_URL}/admin/products/${id}`, {
    headers: adminHeaders(token)
  });
  // ================= CUSTOMER PROFILE =================

export const getProfile = (token) =>
  axios.get(`${AUTH_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

export const updateProfile = (data, token) =>
  axios.put(`${AUTH_URL}/auth/profile`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

// ================= DELIVERY ADDRESS =================

export const updateAddress = (data, token) =>
  axios.put(`${AUTH_URL}/auth/profile/address`, data, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  // ================= CUSTOMER WISHLIST =================

export const getWishlist = (token) =>
  axios.get(`${CORE_URL}/wishlist`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

export const addToWishlist = (productId, token) =>
  axios.post(
    `${CORE_URL}/wishlist`,
    { productId },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

export const removeFromWishlist = (productId, token) =>
  axios.delete(
    `${CORE_URL}/wishlist/${productId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  // ================= AI CUSTOMER SUPPORT =================

export const sendAIMessage = (message, token) =>
  axios.post(
    `${CORE_URL}/ai/chat`,
    { message },
    {
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {},
      timeout: 120000
    }
  );