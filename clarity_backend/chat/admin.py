from django.contrib import admin
from .models import Conversation, ConversationParticipant, Message, TypingIndicator


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'created_at', 'updated_at', 'is_active', 'participants_count']
    list_filter = ['is_active', 'created_at']
    search_fields = ['id', 'title']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ConversationParticipant)
class ConversationParticipantAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'user', 'role', 'joined_at', 'is_active', 'is_online']
    list_filter = ['role', 'is_active', 'is_online', 'joined_at']
    search_fields = ['user__username', 'conversation__id']
    readonly_fields = ['joined_at']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'sender', 'message_type', 'created_at', 'is_read']
    list_filter = ['message_type', 'is_read', 'created_at']
    search_fields = ['content', 'sender__username', 'conversation__id']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(TypingIndicator)
class TypingIndicatorAdmin(admin.ModelAdmin):
    list_display = ['conversation', 'user', 'is_typing', 'last_typed_at']
    list_filter = ['is_typing']
    search_fields = ['user__username', 'conversation__id']
