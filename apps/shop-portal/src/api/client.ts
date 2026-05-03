import axios from 'axios'

const BASE_URL = 'http://localhost:3000/api'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('zuqu_owner_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global 401 handler — token expired or invalid anywhere in the app
api.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('zuqu_owner_token')
      // Redirect to login, preserving current path so they can return after login
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
