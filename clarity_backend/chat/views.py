"""
Chat Views - REST API endpoints for conversation management.

Endpoints:
- GET  /api/conversations/ - List user's conversations
- POST /api/conversations/ - Create new conversation
- GET  /api/conversations/{id}/ - Get conversation details
- POST /api/conversations/{id}/close/ - Close conversation
- GET  /api/conversations/{id}/messages/ - Get message history
- POST /api/conversations/{id}/messages/ - Send message (via REST - prefer WebSocket)
- POST /api/conversations/{id}/read/ - Mark messages as read
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.shortcuts import get_object_or_404

from .models import Conversation, Message
from .serializers import (
    ConversationSerializer,
    ConversationDetailSerializer,
    ConversationCreateSerializer,
    MessageSerializer,
    MessageCreateSerializer,
)
from .services import ConversationService


class MessagePagination(PageNumberPagination):
    """Custom pagination for messages."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 100


class ConversationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing conversations.
    
    list: Get all conversations for the authenticated user
    create: Create or get existing conversation with agent assignment
    retrieve: Get detailed conversation with participants and recent messages
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ConversationSerializer
    
    def get_queryset(self):
        """Return conversations for the authenticated user."""
        return ConversationService.get_user_conversations(self.request.user)
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            return ConversationCreateSerializer
        elif self.action == 'retrieve':
            return ConversationDetailSerializer
        return ConversationSerializer
    
    def list(self, request, *args, **kwargs):
        """
        List all conversations for the authenticated user.
        
        For users: Returns their support conversations
        For agents: Returns all assigned conversations
        """
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
    
    def create(self, request, *args, **kwargs):
        """
        Create a new conversation or return existing active one.
        
        Request body:
        {
            "agent_id": 123,  // Optional: specific agent to assign
            "message": "Hello, I need help"  // Optional: initial message
        }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        agent_id = serializer.validated_data.get('agent_id')
        initial_message = serializer.validated_data.get('message')
        
        # Get or create conversation
        conversation, created = ConversationService.get_or_create_conversation(
            user=request.user,
            agent_id=agent_id
        )
        
        # Send initial message if provided
        if initial_message:
            ConversationService.send_message(
                conversation=conversation,
                sender=request.user,
                content=initial_message,
                message_type='text'
            )
        
        # Return conversation details
        response_serializer = ConversationDetailSerializer(
            conversation,
            context={'request': request}
        )
        
        return Response(
            {
                'conversation': response_serializer.data,
                'created': created,
                'message': 'Conversation created successfully' if created else 'Existing conversation found'
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )
    
    def retrieve(self, request, *args, **kwargs):
        """Get detailed conversation information."""
        conversation = self.get_object()
        
        # Validate access
        try:
            ConversationService.validate_participant_access(conversation, request.user)
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = self.get_serializer(conversation)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """
        Close/deactivate a conversation.
        
        POST /api/conversations/{id}/close/
        """
        conversation = self.get_object()
        
        try:
            ConversationService.close_conversation(conversation, request.user)
            
            # Broadcast conversation closed event to all participants via WebSocket
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from django.utils import timezone
            
            channel_layer = get_channel_layer()
            conversation_group = f'chat_{conversation.id}'
            
            try:
                async_to_sync(channel_layer.group_send)(
                    conversation_group,
                    {
                        'type': 'conversation_closed',
                        'user_id': request.user.id,
                        'username': request.user.username,
                        'timestamp': timezone.now().isoformat()
                    }
                )
            except Exception as broadcast_error:
                # Log but don't fail the request if broadcast fails
                print(f"Failed to broadcast conversation close: {broadcast_error}")
            
            return Response(
                {'message': 'Conversation closed successfully'},
                status=status.HTTP_200_OK
            )
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': 'Failed to close conversation'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'], url_path='messages')
    def messages(self, request, pk=None):
        """
        Get paginated message history for a conversation.
        
        GET /api/conversations/{id}/messages/
        Query params:
        - page: Page number (default: 1)
        - page_size: Messages per page (default: 50, max: 100)
        - before: Message ID to fetch messages before (for infinite scroll)
        """
        conversation = self.get_object()
        
        # Validate access
        try:
            ConversationService.validate_participant_access(conversation, request.user)
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Get pagination parameters
        before_message_id = request.query_params.get('before')
        limit = int(request.query_params.get('page_size', 50))
        limit = min(limit, 100)  # Max 100 messages per request
        
        # Fetch messages
        messages = ConversationService.get_conversation_messages(
            conversation=conversation,
            limit=limit,
            before_message_id=before_message_id
        )
        
        serializer = MessageSerializer(messages, many=True)
        
        return Response({
            'count': messages.count(),
            'results': list(reversed(serializer.data))  # Oldest first
        })
    
    @action(detail=True, methods=['post'], url_path='messages/send')
    def send_message(self, request, pk=None):
        """
        Send a message via REST API.
        
        POST /api/conversations/{id}/messages/send/
        Body: {"content": "Message text", "message_type": "text"}
        
        Note: WebSocket is preferred for real-time messaging.
        This endpoint is a fallback for REST-only clients.
        """
        conversation = self.get_object()
        
        # Validate access
        try:
            ConversationService.validate_participant_access(conversation, request.user)
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Send message
        try:
            message = ConversationService.send_message(
                conversation=conversation,
                sender=request.user,
                content=serializer.validated_data['content'],
                message_type=serializer.validated_data.get('message_type', 'text')
            )
            
            response_serializer = MessageSerializer(message)
            return Response(
                response_serializer.data,
                status=status.HTTP_201_CREATED
            )
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': 'Failed to send message'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        """
        Mark all messages in a conversation as read.
        
        POST /api/conversations/{id}/read/
        """
        conversation = self.get_object()
        
        try:
            ConversationService.mark_messages_as_read(conversation, request.user)
            return Response(
                {'message': 'Messages marked as read'},
                status=status.HTTP_200_OK
            )
        except PermissionDenied as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': 'Failed to mark messages as read'},
                status=status.HTTP_400_BAD_REQUEST
            )


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnly ViewSet for messages.
    
    Messages should primarily be sent via WebSocket.
    This provides REST access for message retrieval.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer
    pagination_class = MessagePagination
    
    def get_queryset(self):
        """Return messages from conversations the user is part of."""
        return Message.objects.filter(
            conversation__participants__user=self.request.user,
            conversation__participants__is_active=True
        ).select_related('sender', 'conversation').order_by('-created_at')
