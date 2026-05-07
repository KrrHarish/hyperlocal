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

// Base URL for static assets (images) — strips the /api suffix
export const IMAGE_BASE = __DEV__
  ? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
  : 'https://api.zuqu.in';

export const WS_URL = __DEV__
  ? (Platform.OS === 'android' ? 'ws://10.0.2.2:3000/ws' : 'ws://localhost:3000/ws')
  : 'wss://api.zuqu.in/ws';

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
  api.post('/auth/otp/send', { phone });

export const verifyOTP = (phone: string, otp: string) =>
  api.post('/auth/otp/verify', { phone, otp });

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

// ── RIDERS ────────────────────────────────────────────
export const checkRiderAvailability = (shopId: string) =>
  api.get('/riders/available', { params: { shop_id: shopId } });

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

export const getRiderLocation = (orderId: string) =>
  api.get(`/orders/${orderId}/rider-location`);

export const confirmDeliveryOTP = (orderId: string, otp: string) =>
  api.post(`/orders/${orderId}/deliver`, { otp });

export const cancelOrder = (orderId: string, reason?: string) =>
  api.post(`/orders/${orderId}/cancel`, { reason });

export const getOrderRating = (orderId: string) =>
  api.get(`/orders/${orderId}/rating`);

export const rateOrder = (orderId: string, payload: { rider_rating: number; shop_rating: number; review?: string }) =>
  api.post(`/orders/${orderId}/rate`, payload);

// ── ADDRESSES ─────────────────────────────────────────
export const getAddresses = () =>
  api.get('/addresses');

export const createAddress = (payload: { label: string; full_address: string; lat?: number; lng?: number }) =>
  api.post('/addresses', payload);

export const updateAddress = (id: string, payload: Partial<{ label: string; full_address: string; lat?: number; lng?: number }>) =>
  api.patch(`/addresses/${id}`, payload);

export const deleteAddress = (id: string) =>
  api.delete(`/addresses/${id}`);

export const setDefaultAddress = (id: string) =>
  api.patch(`/addresses/${id}/default`);

// ── DEALS ─────────────────────────────────────────────
export const getActiveDeals = (lat: number, lng: number) =>
  api.get('/deals/active', { params: { lat, lng } });

export const getShopDeals = (shopId: string) =>
  api.get(`/shops/${shopId}/deals`);

// ── FEED ──────────────────────────────────────────────
export const getNeighbourhoodFeed = (lat: number, lng: number) =>
  api.get('/feed', { params: { lat, lng } });

// ── CHAT ──────────────────────────────────────────────
export const getChatMessages = (shopId: string) =>
  api.get(`/shops/${shopId}/chat`);

export const sendChatMessage = (shopId: string, body: string) =>
  api.post(`/shops/${shopId}/chat`, { body });

// ── SUBSCRIPTIONS ─────────────────────────────────────
export const getSubscriptions = () =>
  api.get('/subscriptions');

export const createSubscription = (payload: {
  shop_id: string;
  items: { shop_product_id: string; product_name: string; quantity: number; unit_price: number }[];
  delivery_address: { line1: string; city: string; pincode: string; lat: number; lng: number };
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  day_of_week?: number;
  label?: string;
}) => api.post('/subscriptions', payload);

export const updateSubscription = (id: string, payload: Partial<{ is_active: boolean; frequency: string; day_of_week: number; label: string }>) =>
  api.patch(`/subscriptions/${id}`, payload);

export const deleteSubscription = (id: string) =>
  api.delete(`/subscriptions/${id}`);

// ── LATE NIGHT SHOPS ──────────────────────────────────
export const getLateNightShops = () =>
  api.get('/shops/late-night');

// ── HOME PRODUCERS ────────────────────────────────────
export const getHomeProducers = (lat: number, lng: number) =>
  api.get('/shops/nearby', { params: { lat, lng, type: 'home_producer' } });

// ── PLATFORM OFFERS ───────────────────────────────────
export const getPlatformOffers = () => api.get('/platform-offers');

export default api;