"""
Chat Services - Business logic for conversation management.

This service layer encapsulates:
- Agent assignment logic
- Conversation lifecycle management
- Access control validation
"""

from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, Count, Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import Conversation, ConversationParticipant, Message


class ConversationService:
    """Service for managing conversations and participants."""
    
    @staticmethod
    def get_or_create_conversation(user, agent_id=None):
        """
        Get existing active conversation or create a new one.
        
        Logic:
        1. Check if user already has an active conversation
        2. If yes, return that conversation
        3. If no, create new conversation with assigned agent
        
        Args:
            user: The user initiating the conversation
            agent_id: Optional specific agent ID to assign
        
        Returns:
            tuple: (conversation, created)
        """
        # Check for existing active conversation for this user
        # Always reuse existing conversation unless specific agent is requested and doesn't match
        existing_participant = ConversationParticipant.objects.filter(
            user=user,
            role='user',
            is_active=True,
            conversation__is_active=True
        ).select_related('conversation').order_by('-conversation__updated_at').first()
        
        # If found and either no specific agent requested or agent matches, reuse it
        if existing_participant:
            if not agent_id:
                return existing_participant.conversation, False
            
            # Check if requested agent is already in this conversation
            agent_in_conversation = existing_participant.conversation.participants.filter(
                role='agent',
                user_id=agent_id,
                is_active=True
            ).exists()
            
            if agent_in_conversation:
                return existing_participant.conversation, False
        
        # Create new conversation
        with transaction.atomic():
            conversation = Conversation.objects.create(
                title=f"Conversation with {user.username}"
            )
            
            # Add user as participant
            ConversationParticipant.objects.create(
                conversation=conversation,
                user=user,
                role='user',
                is_active=True
            )
            
            # Assign agent
            agent = ConversationService._assign_agent(agent_id)
            if agent:
                ConversationParticipant.objects.create(
                    conversation=conversation,
                    user=agent,
                    role='agent',
                    is_active=True
                )
                
                # Send system message about agent assignment
                Message.objects.create(
                    conversation=conversation,
                    sender=agent,  # System message from agent
                    content=f"Agent {agent.get_full_name() or agent.username} has joined the conversation.",
                    message_type='system'
                )
                
                # Send notification to agent about new conversation request
                ConversationService._notify_agent_of_new_conversation(agent, conversation, user)
            
            return conversation, True
    
    @staticmethod
    def _assign_agent(agent_id=None):
        """
        Assign an available agent to a conversation.
        
        Current logic: Assign first available agent or specific agent
        Future enhancements:
        - Load balancing (agent with least active conversations)
        - Skill-based routing
        - Priority queues
        
        Args:
            agent_id: Optional specific agent to assign
        
        Returns:
            User: Agent user object or None
        """
        if agent_id:
            # Assign specific agent if provided
            try:
                agent = User.objects.get(id=agent_id, profile__role='AGENT')
                return agent
            except User.DoesNotExist:
                pass
        
        # Get agent with least active conversations (load balancing)
        agents = User.objects.filter(
            profile__role='AGENT'
        ).annotate(
            active_conversations=Count(
                'conversation_participations',
                filter=Q(
                    conversation_participations__role='agent',
                    conversation_participations__is_active=True,
                    conversation_participations__conversation__is_active=True
                )
            )
        ).order_by('active_conversations')
        
        return agents.first()
    
    @staticmethod
    def _notify_agent_of_new_conversation(agent, conversation, user):
        """
        Send notification to agent about new conversation request.
        
        Args:
            agent: Agent user object
            conversation: Conversation object
            user: User who initiated the conversation
        """
        channel_layer = get_channel_layer()
        notification_group = f'agent_notifications_{agent.id}'
        
        try:
            async_to_sync(channel_layer.group_send)(
                notification_group,
                {
                    'type': 'new_conversation_request',
                    'conversation_id': str(conversation.id),
                    'user_id': user.id,
                    'username': user.username,
                    'timestamp': timezone.now().isoformat()
                }
            )
        except Exception as e:
            # Log error but don't fail the conversation creation
            print(f"Failed to send notification to agent {agent.username}: {str(e)}")
    
    @staticmethod
    def get_user_conversations(user):
        """
        Get all conversations for a user with optimized queries.
        
        For users: Returns their conversations
        For agents: Returns conversations they're assigned to
        """
        return Conversation.objects.filter(
            participants__user=user,
            participants__is_active=True
        ).distinct().select_related(
            # Optimize conversation queries
        ).prefetch_related(
            'participants__user__profile',  # Optimize participant queries
            'messages'  # Optimize last_message queries
        ).annotate(
            # Add participant count annotation for performance
            participant_count=Count('participants', filter=Q(participants__is_active=True))
        ).order_by('-updated_at')
    
    @staticmethod
    def validate_participant_access(conversation, user):
        """
        Validate if a user is a participant in a conversation.
        
        Args:
            conversation: Conversation object
            user: User object
        
        Raises:
            PermissionDenied: If user is not a participant
        """
        is_participant = ConversationParticipant.objects.filter(
            conversation=conversation,
            user=user,
            is_active=True
        ).exists()
        
        if not is_participant:
            raise PermissionDenied("You are not a participant in this conversation.")
    
    @staticmethod
    def send_message(conversation, sender, content, message_type='text'):
        """
        Create and save a message in a conversation.
        
        Args:
            conversation: Conversation object
            sender: User sending the message
            content: Message content
            message_type: Type of message (text, system, file)
        
        Returns:
            Message: Created message object
        """
        # Validate sender is participant
        ConversationService.validate_participant_access(conversation, sender)
        
        # Create message
        message = Message.objects.create(
            conversation=conversation,
            sender=sender,
            content=content,
            message_type=message_type
        )
        
        # Update conversation timestamp
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at'])
        
        return message
    
    @staticmethod
    def mark_messages_as_read(conversation, user):
        """
        Mark all messages in a conversation as read for a user.
        
        Args:
            conversation: Conversation object
            user: User marking messages as read
        """
        # Update participant's last_read_at timestamp
        participant = ConversationParticipant.objects.filter(
            conversation=conversation,
            user=user
        ).first()
        
        if participant:
            participant.mark_as_read()
    
    @staticmethod
    def get_conversation_messages(conversation, limit=50, before_message_id=None):
        """
        Get paginated messages for a conversation with optimized query.
        
        Args:
            conversation: Conversation object
            limit: Number of messages to return
            before_message_id: Get messages before this message ID
        
        Returns:
            QuerySet: Message objects
        """
        messages = conversation.messages.select_related('sender', 'sender__profile').all()
        
        if before_message_id:
            try:
                before_message = Message.objects.get(id=before_message_id)
                messages = messages.filter(created_at__lt=before_message.created_at)
            except Message.DoesNotExist:
                pass
        
        return messages.order_by('-created_at')[:limit]
    
    @staticmethod
    def close_conversation(conversation, user):
        """
        Close/deactivate a conversation.
        
        Args:
            conversation: Conversation object
            user: User closing the conversation
        """
        # Validate access
        ConversationService.validate_participant_access(conversation, user)
        
        # Deactivate conversation
        conversation.is_active = False
        conversation.save(update_fields=['is_active'])
        
        # Deactivate all participants
        ConversationParticipant.objects.filter(
            conversation=conversation
        ).update(is_active=False, left_at=timezone.now())
    
    @staticmethod
    def update_participant_online_status(conversation, user, is_online):
        """
        Update participant's online status.
        
        Args:
            conversation: Conversation object
            user: User object or user ID
            is_online: Boolean online status
        """
        # Handle both User objects and user IDs
        user_id = user.id if hasattr(user, 'id') else user
        
        ConversationParticipant.objects.filter(
            conversation=conversation,
            user_id=user_id
        ).update(is_online=is_online)
