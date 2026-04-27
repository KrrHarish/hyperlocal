import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// iOS simulator  → localhost
// Android emulator → 10.0.2.2 (points to host machine)
// Real device → use your Mac IP e.g. http://192.168.1.5:3000/api
const getBaseURL = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3000/api';
    }
    return 'http://localhost:3000/api';
  }
  return 'https://api.zuqu.in/api'; // production
};

export const API_BASE = getBaseURL();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('zuqu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      AsyncStorage.multiRemove(['zuqu_token', 'zuqu_user_id', 'zuqu_phone']);
    }
    return Promise.reject(error);
  }
);

// ── AUTH ──────────────────────────────────────────────
export const sendOTP = (phone: string) =>
  api.post('/auth/send-otp', { phone });

export const verifyOTP = (phone: string, otp: string) =>
  api.post('/auth/verify-otp', { phone, otp });

// ── SHOPS ─────────────────────────────────────────────
export const getNearbyShops = (lat: number, lng: number, radius = 3000) =>
  api.get('/shops/nearby', { params: { lat, lng, radius } });

export const getShopProducts = (shopId: string) =>
  api.get(`/shops/${shopId}/products`);

// ── PRODUCTS ──────────────────────────────────────────
export const searchProducts = (query: string) =>
  api.get('/products/search', { params: { q: query } });

// ── ORDERS ────────────────────────────────────────────
export const placeOrder = (payload: {
  shop_id: string;
  items: { product_id: string; quantity: number }[];
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
}) => api.post('/orders', payload);

export const getMyOrders = () =>
  api.get('/orders/my');

export const getOrderById = (orderId: string) =>
  api.get(`/orders/${orderId}`);

export const confirmDeliveryOTP = (orderId: string, otp: string) =>
  api.post(`/orders/${orderId}/confirm-delivery`, { otp });

export default api;
