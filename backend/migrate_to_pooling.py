"""
Migration Script: Update call_recording_model.py and user_model.py to use centralized DB
Run this if you encounter issues with the file edits
"""

import os
import sys

# Update user_model.py
user_model_content = '''from utils.db import get_db
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
'''

# Update call_recording_model.py
call_recording_model_content = '''from utils.db import get_db
from datetime import datetime
import logging
from bson.objectid import ObjectId

logger = logging.getLogger(__name__)

class CallRecordingModel:
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
            self.collection = self.db['callrecordings']
            
            # Create indexes (optimized with compound indexes)
            try:
                self.collection.create_index('recordingSid', unique=True)
                self.collection.create_index([('userId', 1), ('createdAt', -1)])
                self.collection.create_index([('agentId', 1), ('createdAt', -1)])
                logger.info("Call recording indexes created successfully")
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")
            
            logger.info("CallRecordingModel initialized successfully")
            self._initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize CallRecordingModel: {e}", exc_info=True)
            raise
    
    def create(self, recording_data):
        """Create a new recording"""
        try:
            recording_data['createdAt'] = datetime.utcnow()
            recording_data['updatedAt'] = datetime.utcnow()
            recording_data['aiProcessed'] = False
            result = self.collection.insert_one(recording_data)
            logger.info(f"Recording created with ID: {result.inserted_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating recording: {e}", exc_info=True)
            raise
    
    def find_one(self, query):
        """Find a single recording"""
        try:
            return self.collection.find_one(query)
        except Exception as e:
            logger.error(f"Error finding recording: {e}", exc_info=True)
            raise
    
    def find_all(self, limit=50):
        """Find all recordings"""
        try:
            return list(self.collection.find().sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding all recordings: {e}", exc_info=True)
            raise
    
    def find_by_user(self, user_id, limit=50):
        """Find recordings by user ID with limit"""
        try:
            return list(self.collection.find(
                {'userId': ObjectId(user_id)}
            ).sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding recordings by user: {e}", exc_info=True)
            raise
    
    def find_by_agent(self, agent_id, limit=50):
        """Find recordings by agent ID with limit"""
        try:
            return list(self.collection.find(
                {'agentId': ObjectId(agent_id)}
            ).sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding recordings by agent: {e}", exc_info=True)
            raise
    
    def update_ticket_status(self, recording_sid, status):
        """Update ticket status"""
        try:
            result = self.collection.update_one(
                {'recordingSid': recording_sid},
                {'$set': {'ticketStatus': status, 'updatedAt': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating ticket status: {e}", exc_info=True)
            raise
    
    def update_with_ai_analysis(self, recording_sid, analysis_result):
        """Update recording with AI analysis results"""
        try:
            result = self.collection.update_one(
                {'recordingSid': recording_sid},
                {
                    '$set': {
                        'aiProcessed': True,
                        'transcript': analysis_result.get('transcript'),
                        'emotionLabel': analysis_result.get('emotion_label'),
                        'emotionScore': analysis_result.get('emotion_score'),
                        'issueCategory': analysis_result.get('issue_category'),
                        'expertiseLevel': analysis_result.get('expertise_level'),
                        'resolutionStatus': analysis_result.get('resolution_status'),
                        'summary': analysis_result.get('summary'),
                        'bulletPoints': analysis_result.get('bullet_points'),
                        'updatedAt': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating recording with AI analysis: {e}", exc_info=True)
            raise
    
    def find_unprocessed_recordings(self, limit=10):
        """Find recordings that haven't been processed by AI"""
        try:
            return list(self.collection.find({'aiProcessed': False}).sort('createdAt', 1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding unprocessed recordings: {e}", exc_info=True)
            raise
    
    def find_by_customer_email(self, email):
        """Find recordings by customer email for context retrieval"""
        try:
            return list(self.collection.find({'customerEmail': email}).sort('createdAt', -1))
        except Exception as e:
            logger.error(f"Error finding recordings by email: {e}", exc_info=True)
            raise

# Initialize model
try:
    call_recording_model = CallRecordingModel()
except Exception as e:
    logger.error(f"Failed to initialize CallRecordingModel: {e}")
    call_recording_model = None
'''

def apply_migrations():
    """Apply migrations by writing correct file contents"""
    base_path = os.path.dirname(os.path.abspath(__file__))
    
    # Update user_model.py
    user_model_path = os.path.join(base_path, 'models', 'user_model.py')
    try:
        with open(user_model_path, 'w') as f:
            f.write(user_model_content)
        print(f"? Updated {user_model_path}")
    except Exception as e:
        print(f"? Error updating {user_model_path}: {e}")
        return False
    
    # Update call_recording_model.py
    call_recording_path = os.path.join(base_path, 'models', 'call_recording_model.py')
    try:
        with open(call_recording_path, 'w') as f:
            f.write(call_recording_model_content)
        print(f"? Updated {call_recording_path}")
    except Exception as e:
        print(f"? Error updating {call_recording_path}: {e}")
        return False
    
    print("\\n? All migrations applied successfully!")
    return True

if __name__ == '__main__':
    apply_migrations()
