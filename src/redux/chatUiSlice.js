import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeConversationId: null,
  unreadCounts: {},
  isSidebarOpen: true,
};

export const chatUiSlice = createSlice({
  name: 'chatUi',
  initialState,
  reducers: {
    setActiveConversation: (state, action) => {
      state.activeConversationId = action.payload;
    },
    clearActiveConversation: (state) => {
      state.activeConversationId = null;
    },
    setUnreadCount: (state, action) => {
      const { conversationId, count } = action.payload;
      state.unreadCounts[conversationId] = count;
    },
    incrementUnreadCount: (state, action) => {
      const conversationId = action.payload;
      state.unreadCounts[conversationId] = (state.unreadCounts[conversationId] || 0) + 1;
    },
    clearUnreadCount: (state, action) => {
      const conversationId = action.payload;
      state.unreadCounts[conversationId] = 0;
    },
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.isSidebarOpen = action.payload;
    },
  },
});

export const {
  setActiveConversation,
  clearActiveConversation,
  setUnreadCount,
  incrementUnreadCount,
  clearUnreadCount,
  toggleSidebar,
  setSidebarOpen,
} = chatUiSlice.actions;

export default chatUiSlice.reducer;

// Selectors
export const selectActiveConversationId = (state) => state.chatUi.activeConversationId;
export const selectUnreadCount = (conversationId) => (state) => 
  state.chatUi.unreadCounts[conversationId] || 0;
export const selectTotalUnreadCount = (state) => 
  Object.values(state.chatUi.unreadCounts).reduce((sum, count) => sum + count, 0);
export const selectIsSidebarOpen = (state) => state.chatUi.isSidebarOpen;
