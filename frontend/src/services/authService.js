import api from './api';

/**
 * Auth service — handles login and registration API calls.
 * Returns the Axios response data directly.
 */

export const loginUser = async (credentials) => {
  const { data } = await api.post('/api/v1/user/login', credentials);
  return data;
};

export const registerUser = async (userData) => {
  const { data } = await api.post('/api/v1/user/register', userData);
  return data;
};
