import { useSelector } from 'react-redux'
import { Navigate } from 'react-router-dom'
import { selectIsAuthenticated, selectUserRole } from '@/redux/slice/user.slice'

const ProtectedRoute = ({ allowedRoles, children }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const role = useSelector(selectUserRole)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'agent') return <Navigate to="/agent/dashboard" replace />
    if (role === 'customer') return <Navigate to="/customer/dashboard" replace />
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
