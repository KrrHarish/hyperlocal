import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

export interface Shop {
  id: string
  name: string
  category: string
  address: string
  is_open: boolean
  is_active: boolean
  lat: number
  lng: number
  rating: number
}

interface AuthContextValue {
  token: string | null
  shop: Shop | null
  loadingShop: boolean
  login: (token: string) => Promise<void>
  logout: () => void
  refreshShop: () => Promise<void>
  setShop: React.Dispatch<React.SetStateAction<Shop | null>>
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('zuqu_owner_token')
  )
  const [shop, setShop] = useState<Shop | null>(null)
  const [loadingShop, setLoadingShop] = useState(false)

  const logout = useCallback(() => {
    localStorage.removeItem('zuqu_owner_token')
    setToken(null)
    setShop(null)
  }, [])

  const refreshShop = useCallback(async () => {
    setLoadingShop(true)
    try {
      const res = await api.get('/shops/my')
      const shops: Shop[] = res.data.shops ?? []
      setShop(shops.length > 0 ? shops[0] : null)
    } catch (e: any) {
      setShop(null)
      // Token expired or invalid — force back to login
      if (e?.response?.status === 401) {
        localStorage.removeItem('zuqu_owner_token')
        setToken(null)
      }
    } finally {
      setLoadingShop(false)
    }
  }, [])

  useEffect(() => {
    if (token) refreshShop()
  }, [token, refreshShop])

  const login = async (newToken: string) => {
    localStorage.setItem('zuqu_owner_token', newToken)
    setToken(newToken)
    // refreshShop will be triggered by the token useEffect above
  }

  return (
    <AuthContext.Provider value={{ token, shop, loadingShop, login, logout, refreshShop, setShop }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
