from utils.db import get_db
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class UserModel:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        try:
            self.db = get_db()
            self.collection = self.db['users']
            
            # Create indexes (idempotent operation)
            try:
                self.collection.create_index('email', unique=True)
                self.collection.create_index('username', unique=True)
                logger.info("User collection indexes created successfully")
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")
            
            logger.info("UserModel initialized successfully")
            self._initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize UserModel: {e}", exc_info=True)
            raise
    
    def find_one(self, query):
        """Find a single user"""
        try:
            return self.collection.find_one(query)
        except Exception as e:
            logger.error(f"Error finding user: {e}", exc_info=True)
            raise
    
    def find_by_id(self, user_id):
        """Find user by ID"""
        from bson.objectid import ObjectId
        try:
            return self.collection.find_one({'_id': ObjectId(user_id)})
        except Exception as e:
            logger.error(f"Error finding user by ID: {e}", exc_info=True)
            raise
    
    def create(self, user_data):
        """Create a new user"""
        try:
            user_data['createdAt'] = datetime.utcnow()
            user_data['updatedAt'] = datetime.utcnow()
            result = self.collection.insert_one(user_data)
            logger.info(f"User created with ID: {result.inserted_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating user: {e}", exc_info=True)
            raise
    
    def find_existing(self, email, username):
        """Check if user exists by email or username"""
        try:
            return self.collection.find_one({'$or': [{'email': email}, {'username': username}]})
        except Exception as e:
            logger.error(f"Error checking existing user: {e}", exc_info=True)
            raise

# Initialize model
try:
    user_model = UserModel()
except Exception as e:
    logger.error(f"Failed to initialize UserModel singleton: {e}")
    user_model = None