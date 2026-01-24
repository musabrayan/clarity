import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import AgentDashboard from './pages/dashboard/agentdashboard'
import UserDashboard from './pages/dashboard/userdashboard'
import CustomerCallPage from './pages/call/customer'
import AgentPanel from './pages/call/agent'

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/agent/dashboard" element={<AgentDashboard />} />
        <Route path="/customer/dashboard" element={<UserDashboard />} />
        <Route path='/customer/call' element={<CustomerCallPage />} />
        <Route path='/agent/call' element={<AgentPanel />} />
      </Routes>
    </Router>
  )
}

export default App