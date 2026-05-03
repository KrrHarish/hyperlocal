import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE = __DEV__
  ? Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api'
  : 'https://api.zuqu.in/api';

export const WS_URL = __DEV__
  ? Platform.OS === 'android' ? 'ws://10.0.2.2:3000/ws' : 'ws://localhost:3000/ws'
  : 'wss://api.zuqu.in/ws';

const api = axios.create({ baseURL: BASE, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('zuqu_rider_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      AsyncStorage.multiRemove(['zuqu_rider_token', 'zuqu_rider_id', 'zuqu_rider_phone']);
    }
    return Promise.reject(err);
  }
);

// Auth
export const riderLogin    = (phone: string)                              => api.post('/riders/login', { phone });
export const riderRegister = (phone: string, name: string, vehicle_type: string) =>
  api.post('/riders/register', { phone, name, vehicle_type });
export const getRiderMe    = ()                                           => api.get('/riders/me');

// Online status + location
export const toggleOnline  = (is_online: boolean, lat?: number, lng?: number) =>
  api.post('/riders/toggle-online', { is_online, lat, lng });
export const updateLocation = (lat: number, lng: number) =>
  api.post('/riders/location', { lat, lng });

// Orders
export const getActiveOrder  = ()                       => api.get('/riders/orders/active');
export const getOrderHistory = ()                       => api.get('/riders/orders/history');
export const acceptOrder     = (orderId: string)        => api.post(`/riders/orders/${orderId}/accept`);
export const rejectOrder     = (orderId: string)        => api.post(`/riders/orders/${orderId}/reject`);
export const confirmPickup   = (orderId: string)        => api.patch(`/riders/orders/${orderId}/pickup`);
export const deliverWithOtp  = (orderId: string, otp: string) =>
  api.post(`/riders/orders/${orderId}/deliver`, { otp });
export const getEarnings     = (period = 'all', from?: string, to?: string) => {
  let url = `/riders/earnings?period=${period}`;
  if (from) url += `&from=${from}`;
  if (to)   url += `&to=${to}`;
  return api.get(url);
};

export default api;
