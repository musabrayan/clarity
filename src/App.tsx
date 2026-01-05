import { useEffect } from "react"
import { Routes, Route } from "react-router-dom"
import { useDispatch } from "react-redux"
import Navbar from "./components/shared/Navbar"
import Home from "./pages/home"
import Login from "./pages/auth/Login"
import Register from "./pages/auth/Register"
import UserDashboard from "./pages/dashboard/UserDashboard"
import AgentDashboard from "./pages/dashboard/AgentDashboard"
import { ThemeProvider } from "@/components/ui/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { setAuth } from "./redux/authSlice"
import type { User } from "./types/auth"

const App = () => {
  const dispatch = useDispatch();

  // Hydrate Redux state from localStorage on app startup
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      
      if (storedUser && accessToken && refreshToken) {
        const user: User = JSON.parse(storedUser);
        // Dispatch all auth data at once
        dispatch(setAuth({ user, accessToken, refreshToken }));
      }
    } catch (error) {
      console.error("Failed to restore auth state:", error);
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
  }, [dispatch]);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/agent/dashboard" element={<AgentDashboard />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  )
}

export default App