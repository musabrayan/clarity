"""
Custom middleware for WebSocket JWT authentication.

This middleware extracts JWT tokens from WebSocket connections and authenticates users.
"""

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser, User
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from urllib.parse import parse_qs


@database_sync_to_async
def get_user_from_token(token_string):
    """
    Get user from JWT token.
    
    Args:
        token_string: JWT access token string
        
    Returns:
        User object if valid token, AnonymousUser otherwise
    """
    try:
        # Validate and decode token
        access_token = AccessToken(token_string)
        user_id = access_token.get('user_id')
        
        # Get user from database
        user = User.objects.get(id=user_id)
        return user
    except TokenError as e:
        print(f"[JWT Auth] Token validation error: {e}")
        return AnonymousUser()
    except User.DoesNotExist:
        print(f"[JWT Auth] User not found for token")
        return AnonymousUser()
    except KeyError as e:
        print(f"[JWT Auth] Missing key in token: {e}")
        return AnonymousUser()
    except Exception as e:
        print(f"[JWT Auth] Unexpected error: {e}")
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware to authenticate WebSocket connections using JWT tokens.
    
    Extracts token from:
    1. Query parameter: ?token=<jwt_token>
    2. Header: Authorization: Bearer <jwt_token>
    """
    
    async def __call__(self, scope, receive, send):
        # Get token from query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        # If no token in query string, check headers
        if not token:
            headers = dict(scope.get('headers', []))
            auth_header = headers.get(b'authorization', b'').decode()
            
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        # Authenticate user with token
        if token:
            user = await get_user_from_token(token)
            scope['user'] = user
        else:
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """
    Convenience function to wrap URLRouter in JWT authentication middleware.
    
    Usage:
        application = ProtocolTypeRouter({
            "websocket": JWTAuthMiddlewareStack(
                URLRouter(
                    websocket_urlpatterns
                )
            ),
        })
    """
    return JWTAuthMiddleware(inner)
