"""
Chat Consumer - WebSocket handler for real-time messaging.

Handles:
- WebSocket authentication
- Message sending and receiving
- Real-time broadcasting to conversation participants
- Typing indicators
- Presence management
- Read receipts
"""

import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import User
from django.utils import timezone

from .models import Conversation, ConversationParticipant, Message, TypingIndicator
from .serializers import MessageSerializer
from .services import ConversationService


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time chat functionality.
    
    WebSocket URL: ws://domain/ws/chat/{conversation_id}/
    
    Message types:
    - message: Send/receive chat messages
    - typing: Typing indicator
    - read: Read receipt
    - presence: Online/offline status
    """
    
    async def connect(self):
        """
        Handle WebSocket connection.
        
        Steps:
        1. Authenticate user
        2. Validate conversation access
        3. Join conversation group
        4. Notify participants of online status
        """
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.conversation_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope['user']
        
        # Authenticate user
        if not self.user.is_authenticated:
            await self.close(code=4001)
            return
        
        # Get actual user ID (resolve lazy object)
        self.user_id = self.user.id
        self.username = self.user.username
        
        # Validate conversation access
        has_access = await self.validate_conversation_access()
        if not has_access:
            await self.close(code=4003)
            return
        
        # Join conversation group
        await self.channel_layer.group_add(
            self.conversation_group_name,
            self.channel_name
        )
        
        await self.accept()
        
        # Update online status
        await self.update_online_status(True)
        
        # Notify other participants that user is online
        await self.channel_layer.group_send(
            self.conversation_group_name,
            {
                'type': 'presence_update',
                'user_id': self.user_id,
                'username': self.username,
                'is_online': True,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        
        Steps:
        1. Update online status
        2. Notify participants of offline status
        3. Leave conversation group
        """
        # Only proceed if connection was successfully established
        if hasattr(self, 'conversation_group_name') and hasattr(self, 'user_id'):
            # Update online status
            await self.update_online_status(False)
            
            # Notify other participants that user is offline
            await self.channel_layer.group_send(
                self.conversation_group_name,
                {
                    'type': 'presence_update',
                    'user_id': self.user_id,
                    'username': self.username,
                    'is_online': False,
                    'timestamp': timezone.now().isoformat()
                }
            )
            
            # Leave conversation group
            await self.channel_layer.group_discard(
                self.conversation_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """
        Handle incoming WebSocket messages.
        
        Expected message format:
        {
            "type": "message|typing|read",
            "content": "message content",  // for type=message
            "is_typing": true/false,       // for type=typing
        }
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'message')
            
            if message_type == 'message':
                await self.handle_message(data)
            elif message_type == 'typing':
                await self.handle_typing(data)
            elif message_type == 'read':
                await self.handle_read_receipt(data)
            else:
                await self.send_error('Unknown message type')
        
        except json.JSONDecodeError:
            await self.send_error('Invalid JSON')
        except Exception as e:
            await self.send_error(f'Error processing message: {str(e)}')
    
    async def handle_message(self, data):
        """
        Handle incoming chat message.
        
        Steps:
        1. Validate message content
        2. Save message to database
        3. Broadcast to all conversation participants
        """
        content = data.get('content', '').strip()
        
        if not content:
            await self.send_error('Message content cannot be empty')
            return
        
        # Save message to database
        message = await self.save_message(content)
        
        if not message:
            await self.send_error('Failed to save message')
            return
        
        # Serialize message
        message_data = await self.serialize_message(message)
        
        # Broadcast to all participants in the conversation
        await self.channel_layer.group_send(
            self.conversation_group_name,
            {
                'type': 'chat_message',
                'message': message_data,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    async def handle_typing(self, data):
        """
        Handle typing indicator.
        
        Broadcasts typing status to other participants.
        """
        is_typing = data.get('is_typing', False)
        
        # Update typing indicator in database (optional - can use Redis)
        await self.update_typing_status(is_typing)
        
        # Broadcast typing indicator to other participants
        await self.channel_layer.group_send(
            self.conversation_group_name,
            {
                'type': 'typing_indicator',
                'user_id': self.user.id,
                'username': self.user.username,
                'is_typing': is_typing,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    async def handle_read_receipt(self, data):
        """
        Handle read receipt.
        
        Marks all messages as read for this user.
        """
        await self.mark_messages_read()
        
        # Notify other participants
        await self.channel_layer.group_send(
            self.conversation_group_name,
            {
                'type': 'read_receipt',
                'user_id': self.user.id,
                'username': self.user.username,
                'timestamp': timezone.now().isoformat()
            }
        )
    
    # Message type handlers (called by channel layer)
    
    async def chat_message(self, event):
        """Send chat message to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'timestamp': event['timestamp']
        }))
    
    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket."""
        # Don't send typing indicator back to the user who is typing
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'typing',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_typing': event['is_typing'],
                'timestamp': event['timestamp']
            }))
    
    async def presence_update(self, event):
        """Send presence update to WebSocket."""
        # Don't send presence update back to the user
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'presence',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_online': event['is_online'],
                'timestamp': event['timestamp']
            }))
    
    async def read_receipt(self, event):
        """Send read receipt to WebSocket."""
        # Don't send read receipt back to the user who read
        if event['user_id'] != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'read',
                'user_id': event['user_id'],
                'username': event['username'],
                'timestamp': event['timestamp']
            }))
    
    async def conversation_closed(self, event):
        """Send conversation closed notification to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'conversation_closed',
            'user_id': event['user_id'],
            'username': event['username'],
            'timestamp': event['timestamp']
        }))
    
    # Helper methods
    
    async def send_error(self, error_message):
        """Send error message to WebSocket."""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'error': error_message,
            'timestamp': timezone.now().isoformat()
        }))
    
    # Database operations (sync to async wrappers)
    
    @database_sync_to_async
    def validate_conversation_access(self):
        """Validate that user is a participant in the conversation."""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            ConversationService.validate_participant_access(conversation, self.user)
            return True
        except Exception:
            return False
    
    @database_sync_to_async
    def save_message(self, content):
        """Save message to database."""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            message = ConversationService.send_message(
                conversation=conversation,
                sender=self.user,
                content=content,
                message_type='text'
            )
            # Use select_related to avoid N+1 query when serializing
            return Message.objects.select_related('sender', 'sender__profile').get(id=message.id)
        except Exception as e:
            print(f"Error saving message: {e}")
            return None
    
    @database_sync_to_async
    def serialize_message(self, message):
        """Serialize message object to dict."""
        serializer = MessageSerializer(message)
        return serializer.data
    
    @database_sync_to_async
    def update_online_status(self, is_online):
        """Update participant's online status."""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            ConversationService.update_participant_online_status(
                conversation=conversation,
                user=self.user,
                is_online=is_online
            )
        except Exception as e:
            print(f"Error updating online status: {e}")
    
    @database_sync_to_async
    def update_typing_status(self, is_typing):
        """Update typing indicator."""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            TypingIndicator.objects.update_or_create(
                conversation=conversation,
                user=self.user,
                defaults={'is_typing': is_typing}
            )
        except Exception as e:
            print(f"Error updating typing status: {e}")
    
    @database_sync_to_async
    def mark_messages_read(self):
        """Mark all messages as read for this user."""
        try:
            conversation = Conversation.objects.get(id=self.conversation_id)
            ConversationService.mark_messages_as_read(conversation, self.user)
        except Exception as e:
            print(f"Error marking messages as read: {e}")
