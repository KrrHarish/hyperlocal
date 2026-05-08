import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext'
import LoginScreen from './screens/LoginScreen'
import PlansScreen from './screens/PlansScreen'
import SubscribeScreen from './screens/SubscribeScreen'
import TrialExpiredScreen from './screens/TrialExpiredScreen'
import Layout from './components/Layout'
import DashboardScreen from './screens/DashboardScreen'
import OrdersScreen from './screens/OrdersScreen'
import CatalogueScreen from './screens/CatalogueScreen'
import DealsScreen from './screens/DealsScreen'
import ChatInboxScreen from './screens/ChatInboxScreen'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/plans" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/plans"         element={<PlansScreen />} />
          <Route path="/login"         element={<LoginScreen />} />
          <Route path="/trial-expired" element={<TrialExpiredScreen />} />

          {/* Protected */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"  element={<DashboardScreen />} />
            <Route path="orders"     element={<OrdersScreen />}    />
            <Route path="catalogue"  element={<CatalogueScreen />} />
            <Route path="deals"      element={<DealsScreen />}     />
            <Route path="chat"       element={<ChatInboxScreen />} />
            <Route path="subscribe"  element={<SubscribeScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/plans" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
