import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { useSelector, useDispatch } from "react-redux"
import { logout } from "../../redux/authSlice"
import { useLogoutMutation } from "../../redux/authApi"

export default function Navbar() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const [logoutMutation] = useLogoutMutation()

  const handleLogout = async () => {
    try {
      await logoutMutation().unwrap()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      dispatch(logout())
      navigate('/')
    }
  }

  return (
    <header className="sticky top-0 z-10 bg-background">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 md:px-12">
        {/* Logo */}
        <div className="flex items-center">
          <img
            src="/logo-white.png"
            alt="logo"
            className="h-16 w-auto object-contain"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="text-sm font-medium mr-4">Welcome, {user?.username}</span>
              <Button variant="ghost" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")}>
                Login
              </Button>
              <Button onClick={() => navigate("/register")}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
