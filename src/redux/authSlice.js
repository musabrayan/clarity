import { createSlice } from '@reduxjs/toolkit';
import { authApi } from './authApi';

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('username');
    },
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    initializeAuth: (state) => {
      const token = localStorage.getItem('authToken');
      const username = localStorage.getItem('username');
      const role = localStorage.getItem('userRole');
      
      if (token && username) {
        state.user = { username, role };
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
            username: payload.username,
            role: payload.role,
          };
          state.isAuthenticated = true;
        }
      )
      // Handle register
      .addMatcher(
        authApi.endpoints.register.matchFulfilled,
        (state, { payload }) => {
          state.user = {
            username: payload.username,
            role: payload.role,
          };
          state.isAuthenticated = true;
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
          localStorage.removeItem('userRole');
          localStorage.removeItem('username');
        }
      );
  },
});

export const { logout, setUser, initializeAuth } = authSlice.actions;
export default authSlice.reducer;
