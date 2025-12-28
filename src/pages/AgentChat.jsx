import React from 'react';
import { useParams } from 'react-router-dom';
import { ChatLayout } from '@/components/chat/ChatLayout';
import { ROUTES } from '@/constants';

/**
 * AgentChat - Agent-facing chat view
 * Uses unified ChatLayout component
 */
export default function AgentChat() {
  const { conversationId } = useParams();

  return (
    <ChatLayout
      conversationId={conversationId}
      dashboardPath={ROUTES.AGENT_DASHBOARD}
      headerTitle="Agent Chat"
    />
  );
}
