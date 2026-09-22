import axios from 'axios';

const AUTH_URL = 'https://auth-service-v2-6jie.onrender.com/api';
const CORE_URL = 'https://core-service-duvc.onrender.com/api';
const PAYMENT_URL = 'https://payment-service-kl28.onrender.com/api';

export const signup = (data) => axios.post(`${AUTH_URL}/auth/signup`, data);
export const login = (data) => axios.post(`${AUTH_URL}/auth/login`, data);

export const getProducts = () => axios.get(`${CORE_URL}/products`);

export const addToCart = (data, token) =>
  axios.post(`${CORE_URL}/cart/add`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const getCart = (token) =>
  axios.get(`${CORE_URL}/cart`, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const placeOrder = (token) =>
  axios.post(`${CORE_URL}/orders`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });

export const makePayment = (data, token) =>
  axios.post(`${PAYMENT_URL}/payment/pay`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });