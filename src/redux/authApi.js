import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
 

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}`,
    credentials: 'include',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    // Register a new user
    register: builder.mutation({
      query: (credentials) => ({
        url: 'api/auth/register/',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.token) {
            localStorage.setItem('authToken', data.token);
          }
          if (data.refresh) {
            localStorage.setItem('refreshToken', data.refresh);
          }
        } catch (err) {
          // Handle registration error
        }
      },
    }),

    // Login user
    login: builder.mutation({
      query: (credentials) => ({
        url: 'api/auth/login/',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.token) {
            localStorage.setItem('authToken', data.token);
          }
          if (data.refresh) {
            localStorage.setItem('refreshToken', data.refresh);
          }
        } catch (err) {
          // Handle login error
        }
      },
    }),

    // Logout user
    logout: builder.mutation({
      query: () => {
        const refreshToken = localStorage.getItem('refreshToken');
        return {
          url: 'api/auth/logout/',
          method: 'POST',
          body: { refresh: refreshToken },
        };
      },
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          localStorage.removeItem('authToken');
          localStorage.removeItem('refreshToken');
          // Invalidate all queries on logout
          dispatch(authApi.util.resetApiState());
        } catch (err) {
          // Handle logout error
        }
      },
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
} = authApi;
