import axios from 'axios'

// Change this to your Mac's local IP when testing on a real phone
// Find it with: ifconfig | grep "inet " (on Mac)
const BASE_URL = 'http://192.168.31.182:3000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Auto-attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Simple token storage
let _token: string | null = null

export const setToken = (token: string) => { _token = token }
export const getToken = async () => _token
export const clearToken = () => { _token = null }