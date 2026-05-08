import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Riders from './pages/Riders'
import RiderDetail from './pages/RiderDetail'
import Shops from './pages/Shops'
import ShopDetail from './pages/ShopDetail'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import FleetMap from './pages/FleetMap'
import PlatformOffers from './pages/PlatformOffers'
import AppCategories from './pages/AppCategories'
import Subscriptions from './pages/Subscriptions'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('zuqu_admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0a', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, padding: 40, fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#EF4444' }}>
            Something went wrong
          </div>
          <pre style={{
            background: '#161616', border: '1px solid #2a2a2a', borderRadius: 10,
            padding: '16px 20px', fontSize: 12, color: '#aaa', maxWidth: 700,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => { this.setState({ error: null }); window.location.href = '/login' }}
            style={{
              padding: '10px 24px', background: '#22C55E', border: 'none',
              borderRadius: 8, color: '#000', fontWeight: 700, cursor: 'pointer',
            }}
          >
            Back to Login
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <RequireAuth>
              <Layout>
                <Routes>
                  <Route path="/"                  element={<Dashboard />} />
                  <Route path="/orders"            element={<Orders />} />
                  <Route path="/riders"            element={<Riders />} />
                  <Route path="/riders/:id"        element={<RiderDetail />} />
                  <Route path="/shops"             element={<Shops />} />
                  <Route path="/shops/:id"         element={<ShopDetail />} />
                  <Route path="/customers"         element={<Customers />} />
                  <Route path="/customers/:id"     element={<CustomerDetail />} />
                  <Route path="/fleet"             element={<FleetMap />} />
                  <Route path="/platform-offers"   element={<PlatformOffers />} />
                  <Route path="/app-categories"    element={<AppCategories />} />
                  <Route path="/subscriptions"     element={<Subscriptions />} />
                  <Route path="*"                  element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
