import { createSlice } from '@reduxjs/toolkit';
import { authApi } from './authApi';

// Initialize auth state from localStorage
const initializeFromStorage = () => {
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  const role = localStorage.getItem('userRole');
  
  if (token && username && userId) {
    return {
      user: {
        id: parseInt(userId),
        username,
        role
      },
      isAuthenticated: true,
      loading: false,
    };
  }
  
  return {
    user: null,
    isAuthenticated: false,
    loading: false,
  };
};

const initialState = initializeFromStorage();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    initializeAuth: (state) => {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      const role = localStorage.getItem('userRole');
      
      if (token && username && userId) {
        state.user = { 
          id: parseInt(userId),
          username, 
          role 
        };
        state.isAuthenticated = true;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle login
      .addMatcher(
        authApi.endpoints.login.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            id: payload.user_id,
            username: payload.username,
            role: payload.role,
          };
          state.isAuthenticated = true;
          // Store user data for persistence
          localStorage.setItem('userId', payload.user_id);
          localStorage.setItem('username', payload.username);
          localStorage.setItem('userRole', payload.role);
        }
      )
      // Handle register
      .addMatcher(
        authApi.endpoints.register.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            id: payload.user_id,
            username: payload.username,
            role: payload.role,
          };
          state.isAuthenticated = true;
          // Store user data for persistence
          localStorage.setItem('userId', payload.user_id);
          localStorage.setItem('username', payload.username);
          localStorage.setItem('userRole', payload.role);
        }
      )
      // Handle logout
      .addMatcher(
        authApi.endpoints.logout.matchFulfilled,
        (state) => {
          state.user = null;
          state.isAuthenticated = false;
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userId');
          localStorage.removeItem('userRole');
          localStorage.removeItem('username');
        }
      );
  },
});

export const { logout, setUser, initializeAuth } = authSlice.actions;
export default authSlice.reducer;
