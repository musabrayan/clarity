from pymongo import MongoClient
from datetime import datetime
import os
from bson.objectid import ObjectId

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
        
        mongo_uri = os.getenv('MONGO_URI')
        if not mongo_uri:
            raise ValueError("MONGO_URI environment variable is not set")
        
        try:
            connection_kwargs = {}
            
            # Development: Add these parameters if connection fails
            if os.getenv('FLASK_ENV') == 'development':
                connection_kwargs['tlsAllowInvalidCertificates'] = True
                connection_kwargs['retryWrites'] = False
            
            self.client = MongoClient(mongo_uri, **connection_kwargs)
            
            # Test connection
            self.client.admin.command('ping')
            print("MongoDB connected successfully")
            
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            self.client = None
            raise
        
        self.db = self.client['clarity']
        self.collection = self.db['callrecordings']
        
        # Create indexes
        try:
            self.collection.create_index('recordingSid', unique=True)
            self.collection.create_index('userId')
            self.collection.create_index('agentId')
            self.collection.create_index('createdAt')
            print("Indexes created successfully")
        except Exception as e:
            print(f"Warning: Could not create indexes: {e}")
        
        self._initialized = True
    
    def create(self, recording_data):
        """Create a new recording"""
        if self.client is None:
            raise Exception("Database connection failed")
        recording_data['createdAt'] = datetime.utcnow()
        recording_data['updatedAt'] = datetime.utcnow()
        recording_data['aiProcessed'] = False
        result = self.collection.insert_one(recording_data)
        return result.inserted_id
    
    def find_one(self, query):
        """Find a single recording"""
        if self.client is None:
            raise Exception("Database connection failed")
        return self.collection.find_one(query)
    
    def find_all(self, limit=50):
        """Find all recordings"""
        if self.client is None:
            raise Exception("Database connection failed")
        return list(self.collection.find().sort('createdAt', -1).limit(limit))
    
    def find_by_user(self, user_id):
        """Find recordings by user ID"""
        if self.client is None:
            raise Exception("Database connection failed")
        return list(self.collection.find({'userId': ObjectId(user_id)}).sort('createdAt', -1))
    
    def find_by_agent(self, agent_id):
        """Find recordings by agent ID"""
        if self.client is None:
            raise Exception("Database connection failed")
        return list(self.collection.find({'agentId': ObjectId(agent_id)}).sort('createdAt', -1))
    
    def update_ticket_status(self, recording_sid, status):
        """Update ticket status"""
        if self.client is None:
            raise Exception("Database connection failed")
        result = self.collection.update_one(
            {'recordingSid': recording_sid},
            {'$set': {'ticketStatus': status, 'updatedAt': datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    def update_with_ai_analysis(self, recording_sid, analysis_data):
        """Update recording with AI analysis results"""
        if self.client is None:
            raise Exception("Database connection failed")
        try:
            result = self.collection.update_one(
                {'recordingSid': recording_sid},
                {
                    '$set': {
                        'transcript': analysis_data.get('transcript'),
                        'emotionLabel': analysis_data.get('emotion_label'),
                        'emotionScore': analysis_data.get('emotion_score'),
                        'issueCategory': analysis_data.get('issue_category'),
                        'expertiseLevel': analysis_data.get('expertise_level'),
                        'resolutionStatus': analysis_data.get('resolution_status'),
                        'summary': analysis_data.get('summary'),
                        'bulletPoints': analysis_data.get('bullet_points'),
                        'aiProcessed': True,
                        'updatedAt': datetime.utcnow()
                    }
                }
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating AI analysis: {e}")
            return False
    
    def find_unprocessed_recordings(self, limit=10):
        """Find recordings that haven't been processed by AI"""
        if self.client is None:
            raise Exception("Database connection failed")
        return list(self.collection.find({'aiProcessed': False}).sort('createdAt', 1).limit(limit))
    
    def find_by_customer_email(self, email):
        """Find recordings by customer email for context retrieval"""
        if self.client is None:
            raise Exception("Database connection failed")
        return list(self.collection.find({'customerEmail': email}).sort('createdAt', -1))

# Initialize model
try:
    call_recording_model = CallRecordingModel()
except Exception as e:
    print(f"Failed to initialize CallRecordingModel: {e}")
    call_recording_model = None