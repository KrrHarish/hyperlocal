import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

type Step = 'phone' | 'otp'

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')

  const { login } = useAuth()
  const navigate = useNavigate()

  const sendOTP = async () => {
    const cleaned = phone.replace(/\D/g, '').replace(/^91/, '')
    if (cleaned.length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/otp/send', { phone: `+91${cleaned}` })
      if (res.data.otp) setDevOtp(res.data.otp)
      setStep('otp')
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const verifyOTP = async () => {
    if (otp.length < 4) {
      setError('Enter the OTP you received')
      return
    }
    setError('')
    setLoading(true)
    try {
      const cleaned = `+91${phone.replace(/\D/g, '').replace(/^91/, '')}`
      const res = await api.post('/auth/otp/verify', { phone: cleaned, otp })
      const token: string = res.data.token

      await login(token)

      // Check if this user owns a shop
      const shopsRes = await api.get('/shops/my', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const shops = shopsRes.data.shops ?? []
      if (shops.length === 0) {
        setError('No shop found for this account. Contact support to register your shop.')
        setLoading(false)
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--green-900) 0%, var(--green-700) 100%)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--green-700)', letterSpacing: '-1px' }}>
            Zuqu
          </div>
          <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4, fontWeight: 500 }}>
            Shop Owner Portal
          </div>
        </div>

        {step === 'phone' ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>
                Mobile Number
              </label>
              <div style={{ display: 'flex', gap: 0 }}>
                <span style={{
                  padding: '10px 14px',
                  background: 'var(--gray-100)',
                  border: '1.5px solid var(--gray-200)',
                  borderRight: 'none',
                  borderRadius: '8px 0 0 8px',
                  fontSize: 14,
                  color: 'var(--gray-500)',
                  fontWeight: 500,
                }}>+91</span>
                <input
                  type="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendOTP()}
                  maxLength={12}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1.5px solid var(--gray-200)',
                    borderRadius: '0 8px 8px 0',
                    fontSize: 16,
                    outline: 'none',
                    letterSpacing: '0.5px',
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '10px 12px', background: 'var(--red-light)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={sendOTP}
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 15 }}
            >
              {loading ? 'Sending…' : 'Send OTP →'}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(''); setDevOtp('') }}
                style={{ background: 'none', color: 'var(--green-600)', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}
              >
                ← +91 {phone}
              </button>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>
                Enter OTP
              </label>
              <input
                type="number"
                placeholder="· · · · · ·"
                value={otp}
                onChange={e => setOtp(e.target.value.slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1.5px solid var(--gray-200)',
                  borderRadius: 8,
                  fontSize: 22,
                  letterSpacing: 8,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
              {devOtp && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gray-400)', textAlign: 'center' }}>
                  Dev OTP: <strong style={{ color: 'var(--green-700)' }}>{devOtp}</strong>
                </div>
              )}
            </div>

            {error && (
              <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 14, padding: '10px 12px', background: 'var(--red-light)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              onClick={verifyOTP}
              disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8 }}
            >
              {loading ? 'Verifying…' : 'Verify & Login →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
