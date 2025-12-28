"""
Chat Serializers - API representations for chat models.
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Conversation, ConversationParticipant, Message, TypingIndicator


class UserSerializer(serializers.ModelSerializer):
    """Basic user information for chat context."""
    is_agent = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'is_agent']
    
    def get_is_agent(self, obj):
        """Check if user is an agent via Profile model."""
        try:
            return obj.profile.role == 'AGENT'
        except:
            return False


class ConversationParticipantSerializer(serializers.ModelSerializer):
    """Participant information within a conversation."""
    user = UserSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ConversationParticipant
        fields = [
            'id', 'user', 'role', 'joined_at', 'left_at', 
            'is_active', 'is_online', 'last_read_at', 'unread_count'
        ]
    
    def get_unread_count(self, obj):
        """Get unread message count for this participant."""
        return obj.get_unread_count()


class MessageSerializer(serializers.ModelSerializer):
    """Message representation with sender details."""
    sender = UserSerializer(read_only=True)
    conversation_id = serializers.UUIDField(source='conversation.id', read_only=True)
    
    class Meta:
        model = Message
        fields = [
            'id', 'conversation_id', 'sender', 'content', 'message_type',
            'created_at', 'updated_at', 'is_read', 'read_at', 'is_edited'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'sender']


class MessageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new messages."""
    
    class Meta:
        model = Message
        fields = ['content', 'message_type']
    
    def validate_content(self, value):
        """Ensure message content is not empty."""
        if not value or not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value.strip()


class ConversationSerializer(serializers.ModelSerializer):
    """Basic conversation information."""
    participants = ConversationParticipantSerializer(many=True, read_only=True)
    last_message = MessageSerializer(read_only=True)
    participants_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'created_at', 'updated_at', 
            'is_active', 'participants', 'last_message', 'participants_count'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ConversationDetailSerializer(serializers.ModelSerializer):
    """Detailed conversation view with participants and recent messages."""
    participants = ConversationParticipantSerializer(many=True, read_only=True)
    recent_messages = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    other_participant = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'title', 'created_at', 'updated_at', 
            'is_active', 'participants', 'recent_messages', 
            'unread_count', 'other_participant'
        ]
    
    def get_recent_messages(self, obj):
        """Get last 20 messages for initial conversation load."""
        messages = obj.messages.order_by('-created_at')[:20]
        # Reverse to show oldest first
        return MessageSerializer(reversed(list(messages)), many=True).data
    
    def get_unread_count(self, obj):
        """Get unread count for the requesting user."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        
        participant = obj.participants.filter(user=request.user).first()
        if participant:
            return participant.get_unread_count()
        return 0
    
    def get_other_participant(self, obj):
        """Get the other participant in 1-to-1 conversations."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        
        other_participant = obj.participants.exclude(user=request.user).first()
        if other_participant:
            return ConversationParticipantSerializer(other_participant).data
        return None


class ConversationCreateSerializer(serializers.Serializer):
    """
    Serializer for creating a new conversation.
    
    For user-initiated conversations: no agent_id needed (auto-assigned)
    For future agent-initiated: can specify user_id
    """
    agent_id = serializers.IntegerField(required=False, allow_null=True)
    message = serializers.CharField(
        required=False, 
        allow_blank=True,
        help_text="Optional initial message to send"
    )
    
    def validate_agent_id(self, value):
        """Validate agent exists and has agent role."""
        if value:
            try:
                user = User.objects.get(id=value)
                if not hasattr(user, 'profile') or user.profile.role != 'AGENT':
                    raise serializers.ValidationError("Specified user is not an agent.")
            except User.DoesNotExist:
                raise serializers.ValidationError("Agent not found.")
        return value
