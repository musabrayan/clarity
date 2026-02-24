from flask import request, jsonify
from functools import wraps
import jwt
import os
import logging

logger = logging.getLogger(__name__)

def is_authenticated(f):
    """Middleware to verify JWT token"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            token = request.cookies.get('token')
            
            if not token:
                logger.warning(f"No token in cookies for {request.path}")
                return jsonify({
                    'message': 'User not authenticated',
                    'success': False
                }), 401
            
            # Decode token
            payload = jwt.decode(token, os.getenv('SECRET_KEY'), algorithms=['HS256'])
            
            if not payload:
                logger.warning(f"Invalid payload for {request.path}")
                return jsonify({
                    'message': 'Invalid token',
                    'success': False
                }), 401
            
            # Attach user ID to request context
            request.user_id = payload.get('userId')
            logger.debug(f"Authenticated user: {request.user_id}")
            
            return f(*args, **kwargs)
        
        except jwt.ExpiredSignatureError:
            logger.warning(f"Token expired for {request.path}")
            return jsonify({
                'message': 'Token has expired',
                'success': False
            }), 401
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid token for {request.path}: {e}")
            return jsonify({
                'message': 'Invalid token',
                'success': False
            }), 401
        except Exception as error:
            logger.error(f"Authentication error for {request.path}: {error}", exc_info=True)
            return jsonify({
                'message': 'Authentication failed',
                'success': False
            }), 401
    
    return decorated_function
