import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { selectIsAuthenticated, selectUserRole } from './redux/slice/user.slice'
import AppLayout from './components/shared/AppLayout'
import AuthLayout from './components/shared/AuthLayout'
import ProtectedRoute from './components/shared/ProtectedRoute'
import LoadingFallback from './components/shared/LoadingFallback'

// ── Lazy-loaded page components ──────────────────────────────────────
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const AgentDashboard = lazy(() => import('./pages/dashboard/agentdashboard'))
const UserDashboard = lazy(() => import('./pages/dashboard/userdashboard'))
const CustomerCallPage = lazy(() => import('./pages/call/customer'))
const AgentPanel = lazy(() => import('./pages/call/agent'))
const CustomerIssues = lazy(() => import('./pages/issues/customer'))
const AgentIssues = lazy(() => import('./pages/issues/agent'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Smart redirect based on auth state and role
function HomeRedirect() {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const role = useSelector(selectUserRole)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role === 'agent') return <Navigate to="/agent/dashboard" replace />
  return <Navigate to="/customer/dashboard" replace />
}

const App = () => {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Home redirect */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Auth routes (no sidebar) */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Agent routes (sidebar layout + role guard) */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['agent']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/agent/dashboard" element={<AgentDashboard />} />
          <Route path="/agent/call" element={<AgentPanel />} />
          <Route path="/agent/issues" element={<AgentIssues />} />
        </Route>

        {/* Customer routes (sidebar layout + role guard) */}
        <Route
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/customer/dashboard" element={<UserDashboard />} />
          <Route path="/customer/issues" element={<CustomerIssues />} />
          <Route path="/customer/call" element={<CustomerCallPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Router>
  )
}

export default App