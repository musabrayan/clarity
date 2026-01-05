import axios, { AxiosError } from 'axios';
import { RegisterRequest, LoginRequest, User, AuthTokens, ApiResponse } from '../types/auth';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const handleError = (error: AxiosError<any>): { success: false; error: any } => {
  const data = error.response?.data;
  return {
    success: false,
    error: data?.error || data?.detail || error.message || 'An error occurred',
  };
};

export const register = async (data: RegisterRequest): Promise<ApiResponse<any>> => {
  try {
    const response = await api.post('/auth/register', data);
    return response.data;
  } catch (error) {
    return handleError(error as AxiosError);
  }
};

export const login = async (data: LoginRequest): Promise<ApiResponse<{ user: User; tokens: AuthTokens }>> => {
  try {
    const response = await api.post('/auth/login', data);
    // Don't store here - let Redux handle it via setAuth action
    return response.data;
  } catch (error) {
    return handleError(error as AxiosError);
  }
};

export const refreshToken = async (): Promise<ApiResponse<{ access: string }>> => {
  try {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) return { success: false, error: 'No refresh token' };
    
    const response = await api.post('/auth/refresh', { refresh });
    // Return new token - caller should dispatch setAccessToken action
    return { success: true, data: response.data };
  } catch (error) {
    // Don't clear here - let caller handle via clearAuth action
    return handleError(error as AxiosError);
  }
};

export const getMe = async (): Promise<ApiResponse<User>> => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    return handleError(error as AxiosError);
  }
};

export const logout = async (): Promise<ApiResponse<{ message: string }>> => {
  try {
    const refresh = localStorage.getItem('refreshToken');
    if (refresh) await api.post('/auth/logout', { refresh });
  } catch (error) {
    // Ignore logout errors
  }
  // Don't clear localStorage here - let caller dispatch clearAuth action
  return { success: true, data: { message: 'Logged out successfully' } };
};

export const isAuthenticated = (): boolean => {
  return !!(localStorage.getItem('accessToken') && localStorage.getItem('refreshToken'));
};
