import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const getBaseURL = () => {
  if (__DEV__) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api';
    return 'http://localhost:3000/api';
  }
  return 'https://api.zuqu.in/api';
};

export const API_BASE = getBaseURL();

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('zuqu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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

export const getShopById = (shopId: string) =>
  api.get(`/shops/${shopId}`);

export const getShopProducts = (shopId: string) =>
  api.get(`/shops/${shopId}/products`);

// ── PRODUCTS ──────────────────────────────────────────
export const searchProducts = (query: string) =>
  api.get('/products/search', { params: { q: query } });

export const getProductsByCategory = (category: string) =>
  api.get('/products/by-category', { params: { category } });

// ── ORDERS ────────────────────────────────────────────
export const placeOrder = (payload: {
  shop_id: string;
  items: { shop_product_id: string; quantity: number }[];
  delivery_address: {
    line1: string;
    city: string;
    pincode: string;
    lat: number;
    lng: number;
  };
}) => api.post('/orders', payload);

export const getMyOrders = () =>
  api.get('/orders');

export const getOrderById = (orderId: string) =>
  api.get(`/orders/${orderId}`);

export const confirmDeliveryOTP = (orderId: string, otp: string) =>
  api.post(`/orders/${orderId}/deliver`, { otp });

export const cancelOrder = (orderId: string, reason?: string) =>
  api.post(`/orders/${orderId}/cancel`, { reason });

export default api;