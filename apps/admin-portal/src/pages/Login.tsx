import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../api/client'

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await adminLogin(email, password)
      localStorage.setItem('zuqu_admin_token', res.data.token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#111',
        border: '1px solid #222',
        borderRadius: 20,
        padding: '40px 36px',
        width: '100%',
        maxWidth: 400,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#22C55E', letterSpacing: '-1px' }}>
            Zuqu
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4, fontWeight: 600 }}>
            Admin Portal
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 6 }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#666', fontWeight: 600, marginBottom: 6 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: '#2d0d0d', border: '1px solid #EF444440',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#EF4444',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: '13px',
              borderRadius: 10,
              border: 'none',
              background: loading ? '#1a3a25' : '#22C55E',
              color: loading ? '#4ade80' : '#000',
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  background: '#161616',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#fff',
  fontSize: 14,
  outline: 'none',
}
