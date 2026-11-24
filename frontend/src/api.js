
import axios from 'axios';

// Authentication service
const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ||
  'https://auth-service-v2-6jie.onrender.com/api';

// Core service
const CORE_URL =
  'https://core-service-duvc.onrender.com/api';

// Payment service
const PAYMENT_URL =
  'https://payment-service-kl28.onrender.com/api';

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
    headers: { Authorization: `Bearer ${token}` }
  });

export const getCart = (token) =>
  axios.get(`${CORE_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });

// ================= ORDERS =================

export const placeOrder = (token) =>
  axios.post(`${CORE_URL}/orders`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

// ================= PAYMENT =================

export const makePayment = (data, token) =>
  axios.post(`${PAYMENT_URL}/payment/pay`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
