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
