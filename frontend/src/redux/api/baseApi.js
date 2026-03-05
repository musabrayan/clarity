import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import API_URL from '@/config';

/**
 * RTK Query base API.
 * All endpoint modules inject into this single API instance.
 */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    credentials: 'include',           // session cookies
  }),
  tagTypes: ['Recordings', 'Issues', 'CustomerHistory'],
  endpoints: () => ({}),               // injected by domain slices
});
