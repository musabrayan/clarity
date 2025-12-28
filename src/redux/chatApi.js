import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${API_BASE_URL}/api/chat`,
    credentials: 'include',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Conversations', 'Messages'],
  endpoints: (builder) => ({
    // Get all conversations for the authenticated user
    getConversations: builder.query({
      query: () => '/conversations/',
      providesTags: ['Conversations'],
      transformResponse: (response) => response.results || response,
    }),

    // Get a specific conversation by ID
    getConversation: builder.query({
      query: (conversationId) => `/conversations/${conversationId}/`,
      providesTags: (result, error, conversationId) => [
        { type: 'Conversations', id: conversationId },
      ],
    }),

    // Create a new conversation
    createConversation: builder.mutation({
      query: (data) => ({
        url: '/conversations/',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Conversations'],
    }),

    // Get messages for a specific conversation
    getMessages: builder.query({
      query: ({ conversationId, page = 1 }) => 
        `/conversations/${conversationId}/messages/?page=${page}`,
      providesTags: (result, error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
      ],
      serializeQueryArgs: ({ endpointName, queryArgs }) => {
        return `${endpointName}-${queryArgs.conversationId}`;
      },
      merge: (currentCache, newItems, { arg }) => {
        // For pagination, merge pages
        if (arg.page > 1) {
          return {
            ...newItems,
            results: [...currentCache.results, ...newItems.results],
          };
        }
        return newItems;
      },
      forceRefetch: ({ currentArg, previousArg }) => {
        return currentArg?.page !== previousArg?.page;
      },
    }),

    // Send a message (REST fallback - prefer WebSocket)
    sendMessage: builder.mutation({
      query: ({ conversationId, content }) => ({
        url: `/conversations/${conversationId}/messages/send/`,
        method: 'POST',
        body: { content },
      }),
      invalidatesTags: (result, error, { conversationId }) => [
        { type: 'Messages', id: conversationId },
      ],
    }),

    // Mark messages as read
    markAsRead: builder.mutation({
      query: (conversationId) => ({
        url: `/conversations/${conversationId}/read/`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, conversationId) => [
        { type: 'Conversations', id: conversationId },
        'Conversations',
      ],
    }),

    // Close a conversation
    closeConversation: builder.mutation({
      query: (conversationId) => ({
        url: `/conversations/${conversationId}/close/`,
        method: 'POST',
      }),
      invalidatesTags: ['Conversations'],
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetConversationQuery,
  useCreateConversationMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useCloseConversationMutation,
} = chatApi;
