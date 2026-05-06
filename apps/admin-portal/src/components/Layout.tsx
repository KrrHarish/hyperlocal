import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

const NAV = [
  { to: '/',          label: 'Dashboard', icon: '▦' },
  { to: '/orders',    label: 'Orders',    icon: '🧾' },
  { to: '/riders',    label: 'Riders',    icon: '🛵' },
  { to: '/shops',     label: 'Shops',     icon: '🏪' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/fleet',     label: 'Fleet Map', icon: '🗺️' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('zuqu_admin_token')
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: '#111',
        borderRight: '1px solid #1e1e1e',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1e1e1e' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#22C55E', letterSpacing: '-0.5px' }}>
            Zuqu
          </div>
          <div style={{ fontSize: 11, color: '#444', fontWeight: 600, marginTop: 2 }}>
            ADMIN PORTAL
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13.5,
                color: isActive ? '#22C55E' : '#666',
                background: isActive ? '#0d2a18' : 'transparent',
                transition: 'all 0.15s',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid #1e1e1e' }}>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#555',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>→</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#0a0a0a' }}>
        {children}
      </main>
    </div>
  )
}
