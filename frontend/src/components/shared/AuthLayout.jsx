import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'
import { selectIsAuthenticated, selectCurrentUser } from '@/redux/slice/user.slice'

export default function AuthLayout() {
  const isAuthenticated = useSelector(selectIsAuthenticated)
  const currentUser = useSelector(selectCurrentUser)

  // If already authenticated, redirect to appropriate dashboard
  if (isAuthenticated && currentUser) {
    if (currentUser.role === 'agent') {
      return <Navigate to="/agent/dashboard" replace />
    }
    return <Navigate to="/customer/dashboard" replace />
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left Panel — Branding (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between bg-muted p-10">
        <div className="flex items-center gap-2">
          <img src="/clarity.png" alt="Clarity Logo" className="h-8 w-8 object-contain mix-blend-screen" />
          <span className="text-lg font-semibold">Clarity</span>
        </div>
        <div className="space-y-4">
          <h2 className="text-3xl font-bold tracking-tight">
            AI-Powered Call Support That Remembers Every Conversation
          </h2>
          <p className="text-muted-foreground">
            Automatically capture call context, recall previous conversations,
            and generate accurate AI summaries for faster and smarter customer
            support.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Clarity. All rights reserved.
        </p>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/clarity.png" alt="Clarity Logo" className="h-8 w-8 object-contain mix-blend-screen" />
            <span className="text-lg font-semibold">Clarity</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
