"""
Chat Models - Conversation-centric architecture for scalable real-time messaging.

This design supports:
- Current: 1-to-1 user-agent conversations
- Future: One-agent-to-many-users, group chats, bot participants
"""

import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Conversation(models.Model):
    """
    Represents a chat conversation.
    
    Conversation-centric design allows flexible participant configurations:
    - 1-to-1 (current)
    - 1-to-many (future)
    - Group chats (future)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, db_index=True)
    
    # Optional: Conversation metadata
    title = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['is_active', '-updated_at']),
        ]
    
    def __str__(self):
        return f"Conversation {self.id} ({'Active' if self.is_active else 'Inactive'})"
    
    @property
    def participants_count(self):
        """Returns the number of participants in this conversation."""
        return self.participants.count()
    
    @property
    def last_message(self):
        """Returns the most recent message in this conversation."""
        return self.messages.order_by('-created_at').first()


class ConversationParticipant(models.Model):
    """
    Represents a user's participation in a conversation with their role.
    
    Role-based design enables:
    - Flexible role assignment (user, agent, bot, moderator, etc.)
    - Multiple participants with different roles
    - Easy expansion without schema changes
    """
    
    ROLE_CHOICES = [
        ('user', 'User'),
        ('agent', 'Agent'),
        ('bot', 'Bot'),  # Future use
        ('moderator', 'Moderator'),  # Future use for group chats
    ]
    
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='participants'
    )
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='conversation_participations'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, db_index=True)
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    # Metadata for future enhancements
    last_read_at = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    
    class Meta:
        unique_together = ['conversation', 'user']
        ordering = ['joined_at']
        indexes = [
            models.Index(fields=['conversation', 'role']),
            models.Index(fields=['user', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.user.username} ({self.role}) in Conversation {self.conversation.id}"
    
    def mark_as_read(self):
        """Mark all messages as read up to current time."""
        self.last_read_at = timezone.now()
        self.save(update_fields=['last_read_at'])
    
    def get_unread_count(self):
        """Get count of unread messages for this participant."""
        if not self.last_read_at:
            return self.conversation.messages.exclude(sender=self.user).count()
        return self.conversation.messages.filter(
            created_at__gt=self.last_read_at
        ).exclude(sender=self.user).count()


class Message(models.Model):
    """
    Represents a message within a conversation.
    
    Simple and extensible design supports:
    - Text messages (current)
    - Future: file attachments, reactions, threading
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='messages'
    )
    sender = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='sent_messages'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Read receipt tracking
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    # Message type for future extensibility
    MESSAGE_TYPE_CHOICES = [
        ('text', 'Text'),
        ('system', 'System'),  # e.g., "User joined", "Agent assigned"
        ('file', 'File'),  # Future use
    ]
    message_type = models.CharField(
        max_length=20, 
        choices=MESSAGE_TYPE_CHOICES, 
        default='text'
    )
    
    # Optional: For edited messages
    is_edited = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
            models.Index(fields=['sender', 'created_at']),
            models.Index(fields=['conversation', 'is_read']),
        ]
    
    def __str__(self):
        return f"Message from {self.sender.username} at {self.created_at}"
    
    def mark_as_read(self):
        """Mark this message as read."""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class TypingIndicator(models.Model):
    """
    Tracks real-time typing status for presence features.
    
    Ephemeral data - can be stored in Redis for production.
    This model provides a database fallback.
    """
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='typing_indicators'
    )
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='typing_in'
    )
    is_typing = models.BooleanField(default=False)
    last_typed_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['conversation', 'user']
        indexes = [
            models.Index(fields=['conversation', 'is_typing']),
        ]
    
    def __str__(self):
        return f"{self.user.username} typing in {self.conversation.id}"
