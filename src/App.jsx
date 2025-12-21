import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Home from './components/Home';
import AgentDashboard from './components/dashboard/AgentDashboard';
import UserDashBoard from './components/dashboard/UserDashBoard';
import { initializeAuth } from './redux/authSlice';

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/agent-dashboard" element={<AgentDashboard />} />
        <Route path="/user-dashboard" element={<UserDashBoard />} />
        <Route path="/" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
