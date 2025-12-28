import React from 'react';
import { useParams } from 'react-router-dom';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ROUTES } from '@/constants';

/**
 * UserChat - User-facing chat view
 * Uses unified ChatLayout component
 */
export default function UserChat() {
  const { conversationId } = useParams();

  return (
    <ChatLayout
      conversationId={conversationId}
      dashboardPath={ROUTES.DASHBOARD}
      headerTitle="Support Chat"
    />
  );
}
