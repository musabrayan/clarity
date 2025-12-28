"""
WebSocket Routing Configuration for Chat Application.
"""

from django.urls import re_path
from . import consumers
from .notification_consumer import AgentNotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/chat/(?P<conversation_id>[0-9a-f-]+)/$', consumers.ChatConsumer.as_asgi()),
    re_path(r'ws/agent/notifications/$', AgentNotificationConsumer.as_asgi()),
]
