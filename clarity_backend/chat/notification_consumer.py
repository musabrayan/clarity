"""
Notification Consumer - WebSocket handler for agent notifications.

Handles:
- Agent connection to notification channel
- Broadcasting new conversation requests to available agents
- Real-time notification delivery
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User


class AgentNotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for agent notifications.
    
    WebSocket URL: ws://domain/ws/agent/notifications/
    
    Notification types:
    - new_conversation_request: New user wants to chat
    - conversation_assigned: Conversation assigned to agent
    """
    
    async def connect(self):
        """
        Handle WebSocket connection for agent notifications.
        
        Steps:
        1. Authenticate user
        2. Verify user is an agent
        3. Join agent notification group
        """
        self.user = self.scope['user']
        
        # Authenticate user
        if not self.user.is_authenticated:
            await self.close(code=4001)
            return
        
        # Verify user is an agent
        is_agent = await self.check_if_agent()
        if not is_agent:
            await self.close(code=4003)
            return
        
        self.user_id = self.user.id
        self.username = self.user.username
        
        # Join agent notification group
        self.notification_group_name = f'agent_notifications_{self.user_id}'
        
        await self.channel_layer.group_add(
            self.notification_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        print(f"Agent {self.username} connected to notification channel")
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        """
        if hasattr(self, 'notification_group_name'):
            await self.channel_layer.group_discard(
                self.notification_group_name,
                self.channel_name
            )
            print(f"Agent {self.username} disconnected from notification channel")
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages from agent.
        
        Currently not expecting messages from agents on this channel.
        This is primarily for pushing notifications TO agents.
        """
        try:
            data = json.loads(text_data)
            # Can handle acknowledgments or other agent actions here
            pass
        except json.JSONDecodeError:
            pass
    
    async def new_conversation_request(self, event):
        """
        Handle new conversation request notification.
        
        Sends notification to agent about new user wanting to chat.
        """
        await self.send(text_data=json.dumps({
            'type': 'new_conversation_request',
            'conversation_id': event['conversation_id'],
            'user_id': event['user_id'],
            'username': event['username'],
            'timestamp': event['timestamp']
        }))
    
    async def conversation_assigned(self, event):
        """
        Handle conversation assignment notification.
        
        Notifies agent that a conversation has been assigned to them.
        """
        await self.send(text_data=json.dumps({
            'type': 'conversation_assigned',
            'conversation_id': event['conversation_id'],
            'user_id': event['user_id'],
            'username': event['username'],
            'timestamp': event['timestamp']
        }))
    
    @database_sync_to_async
    def check_if_agent(self):
        """Check if the user is an agent."""
        try:
            return hasattr(self.user, 'profile') and self.user.profile.role == 'AGENT'
        except Exception:
            return False
