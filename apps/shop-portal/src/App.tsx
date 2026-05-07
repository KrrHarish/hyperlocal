import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext'
import LoginScreen from './screens/LoginScreen'
import Layout from './components/Layout'
import DashboardScreen from './screens/DashboardScreen'
import OrdersScreen from './screens/OrdersScreen'
import CatalogueScreen from './screens/CatalogueScreen'
import DealsScreen from './screens/DealsScreen'
import ChatInboxScreen from './screens/ChatInboxScreen'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardScreen />} />
            <Route path="orders"    element={<OrdersScreen />}   />
            <Route path="catalogue" element={<CatalogueScreen />} />
            <Route path="deals"     element={<DealsScreen />} />
            <Route path="chat"      element={<ChatInboxScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
