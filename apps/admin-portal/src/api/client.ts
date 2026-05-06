import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const api = axios.create({ baseURL: BASE, timeout: 15000 })

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('zuqu_admin_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('zuqu_admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const adminLogin = (email: string, password: string) =>
  api.post('/admin/login', { email, password })

// ── Stats ─────────────────────────────────────────────────────────────────────
export const getStats = (params?: Record<string, string>) =>
  api.get('/admin/stats', { params })

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders = (params?: Record<string, string>) =>
  api.get('/admin/orders', { params })

// ── Riders ────────────────────────────────────────────────────────────────────
export const getRiders = (params?: Record<string, string>) =>
  api.get('/admin/riders', { params })
export const getRider = (id: string) => api.get(`/admin/riders/${id}`)

// ── Shops ─────────────────────────────────────────────────────────────────────
export const getShops = (params?: Record<string, string>) =>
  api.get('/admin/shops', { params })
export const getShop = (id: string) => api.get(`/admin/shops/${id}`)

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomers = (params?: Record<string, string>) =>
  api.get('/admin/customers', { params })
export const getCustomer = (id: string) => api.get(`/admin/customers/${id}`)

// ── Live rider tracking ───────────────────────────────────────────────────────
export const getRidersLive = () => api.get('/admin/riders/live')

// ── Rider actions ─────────────────────────────────────────────────────────────
export const suspendRider  = (id: string, suspend: boolean)                           => api.patch(`/admin/riders/${id}/suspend`, { suspend })
export const verifyRider   = (id: string, verify: boolean)                            => api.patch(`/admin/riders/${id}/verify`,  { verify })
export const adjustWallet  = (id: string, amount: number, note: string)               => api.patch(`/admin/riders/${id}/wallet`,  { amount, note })
export const createRider   = (data: { name: string; phone: string; vehicle_type: string }) => api.post('/admin/riders', data)

// ── Shop actions ──────────────────────────────────────────────────────────────
export const createShop        = (data: any)                                          => api.post('/admin/shops', data)
export const updateShop        = (id: string, data: any)                              => api.patch(`/admin/shops/${id}`, data)
export const suspendShop       = (id: string)                                         => api.patch(`/admin/shops/${id}/suspend`, {})
export const getShopCredentials= (id: string)                                         => api.get(`/admin/shops/${id}/credentials`)
export const setShopCredentials= (id: string, username: string, password: string)     => api.post(`/admin/shops/${id}/credentials`, { username, password })
export const seedShopCatalogue = (id: string)                                         => api.post(`/admin/shops/${id}/seed-catalogue`)
export const uploadShopImage   = (id: string, file: File)                             => {
  const form = new FormData(); form.append('file', file)
  return api.post(`/admin/shops/${id}/image`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
}

// ── CSV exports ───────────────────────────────────────────────────────────────
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
