import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../store/AuthContext'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleLogin = async () => {
    if (!username.trim()) { setError('Enter your username'); return }
    if (!password)        { setError('Enter your password'); return }

    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/shop/login', {
        username: username.trim().toLowerCase(),
        password,
      })
      await login(res.data.token)
      navigate('/dashboard', { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Login failed. Check your credentials.')
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
      background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: '#065f46', letterSpacing: '-1px' }}>
            Zuqu
          </div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4, fontWeight: 500 }}>
            Shop Owner Portal
          </div>
        </div>

        {/* Username */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Username
          </label>
          <input
            type="text"
            placeholder="your-shop-username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoCapitalize="none"
            autoComplete="username"
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoComplete="current-password"
              style={{ ...inputStyle, paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: 16, padding: 0,
              }}
            >
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            color: '#b91c1c', fontSize: 13, marginBottom: 16,
            padding: '10px 12px', background: '#fef2f2',
            borderRadius: 8, border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
            background: loading ? '#6ee7b7' : '#065f46',
            color: '#fff', border: 'none', borderRadius: 10,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 20 }}>
          Credentials are provided by your administrator
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
