import { api, setToken } from './client'

export async function sendOTP(phone: string) {
  const res = await api.post('/auth/otp/send', { phone })
  return res.data
}

export async function verifyOTP(phone: string, otp: string) {
  const res = await api.post('/auth/otp/verify', { phone, otp })
  setToken(res.data.token)
  return res.data
}