import { create } from 'zustand'
import { setToken, clearToken } from '../api/client'

interface User {
  id: string
  phone: string
  name: string | null
}

interface AuthState {
  user: User | null
  token: string | null
  isLoggedIn: boolean
  login: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoggedIn: false,

  login: (user, token) => {
    setToken(token)
    set({ user, token, isLoggedIn: true })
  },

  logout: () => {
    clearToken()
    set({ user: null, token: null, isLoggedIn: false })
  },
}))