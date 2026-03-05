import axios from 'axios';
import API_URL from '@/config';

/**
 * Shared Axios instance for all API calls.
 * - Base URL from environment config
 * - Cookies sent automatically (session auth)
 * - JSON content type by default
 */
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Response interceptor ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Centralised error logging (no console in production)
    if (import.meta.env.DEV) {
      console.error('[API]', error?.config?.url, error?.response?.status, error?.message);
    }
    return Promise.reject(error);
  },
);

export default api;
