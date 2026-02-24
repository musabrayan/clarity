from flask import request, jsonify, make_response
from models.user_model import user_model
from bson.objectid import ObjectId
import bcrypt
import jwt
import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        full_name = data.get('fullName')
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        phone_number = data.get('phoneNumber')
        role = data.get('role')
        
        # Validate all fields
        if not all([full_name, username, email, password, phone_number, role]):
            return jsonify({
                'message': 'All fields are required',
                'success': False
            }), 400
        
        # Validate role
        if role not in ['customer', 'agent']:
            return jsonify({
                'message': "Role must be either 'customer' or 'agent'",
                'success': False
            }), 400
        
        # Check if user already exists
        existing_user = user_model.find_existing(email, username)
        if existing_user:
            return jsonify({
                'message': 'User already exists with this email or username',
                'success': False
            }), 400
        
        # Hash password using optimized salt rounds
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(12))
        
        # Create new user
        user_model.create({
            'fullName': full_name,
            'username': username,
            'email': email,
            'password': hashed_password,
            'phoneNumber': phone_number,
            'role': role
        })
        
        logger.info(f"User registered: {email} (role: {role})")
        
        return jsonify({
            'message': 'Account created successfully',
            'success': True
        }), 201
    
    except Exception as error:
        logger.error(f"Registration error: {error}", exc_info=True)
        return jsonify({
            'message': 'Server error',
            'success': False
        }), 500

def login():
    """Login user"""
    try:
        data = request.get_json()
        
        email = data.get('email')
        username = data.get('username')
        password = data.get('password')
        
        # Validate credentials
        if (not email and not username) or not password:
            return jsonify({
                'message': 'Username/email and password are required',
                'success': False
            }), 400
        
        # Find user
        user = user_model.find_one({'$or': [{'email': email}, {'username': username}]})
        
        if not user:
            logger.warning(f"Login attempt failed: user not found ({email or username})")
            return jsonify({
                'message': 'Incorrect username/email or password',
                'success': False
            }), 400
        
        # Check password
        if not bcrypt.checkpw(password.encode('utf-8'), user['password']):
            logger.warning(f"Login attempt failed: incorrect password ({email or username})")
            return jsonify({
                'message': 'Incorrect username/email or password',
                'success': False
            }), 400
        
        # Generate JWT token
        token_data = {
            'userId': str(user['_id']),
            'exp': datetime.utcnow() + timedelta(hours=24)
        }
        token = jwt.encode(
            token_data,
            os.getenv('SECRET_KEY'),
            algorithm='HS256'
        )
        
        # Prepare response
        response_data = {
            'message': f"Welcome back {user['fullName']}",
            'user': {
                '_id': str(user['_id']),
                'fullName': user['fullName'],
                'username': user['username'],
                'email': user['email'],
                'phoneNumber': user['phoneNumber'],
                'role': user['role']
            },
            'success': True
        }
        
        logger.info(f"User logged in: {email or username}")
        
        response = make_response(jsonify(response_data), 200)
        
        # Set cookie with secure flag only in production
        is_production = os.getenv('FLASK_ENV') == 'production'
        
        response.set_cookie(
            'token',
            token,
            max_age=24 * 60 * 60,
            httponly=True,
            secure=is_production,  # ? HTTPS only in production
            samesite='None' if is_production else 'Lax'  # ? More lenient in dev
        )
        
        return response
    
    except Exception as error:
        logger.error(f"Login error: {error}", exc_info=True)
        return jsonify({
            'message': 'Server error',
            'success': False
        }), 500

def logout():
    """Logout user"""
    try:
        response = make_response(jsonify({
            'message': 'Logged out successfully',
            'success': True
        }), 200)
        
        response.set_cookie('token', '', max_age=0)
        logger.info("User logged out")
        
        return response
    
    except Exception as error:
        logger.error(f"Logout error: {error}", exc_info=True)
        return jsonify({
            'message': 'Server error',
            'success': False
        }), 500