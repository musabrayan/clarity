from utils.db import get_db
from datetime import datetime
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

class CallsModel:
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
            self.collection = self.db['calls']
            
            # Create optimized indexes
            try:
                self.collection.create_index('recordingSid')
                self.collection.create_index([('customerId', 1), ('createdAt', -1)])
                logger.info("Calls collection indexes created successfully")
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")
            
            logger.info("CallsModel initialized successfully")
            self._initialized = True
            
        except Exception as e:
            logger.error(f"Failed to initialize CallsModel: {e}", exc_info=True)
            raise
    
    
    def create(self, call_data):
        """Create a new call record with AI analysis"""
        try:
            call_data['createdAt'] = datetime.utcnow()
            call_data['updatedAt'] = datetime.utcnow()
            
            result = self.collection.insert_one(call_data)
            logger.info(f"Call record created with ID: {result.inserted_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating call record: {e}", exc_info=True)
            raise
    
    def find_by_customer(self, customer_id, limit=50):
        """Find all calls for a specific customer"""
        try:
            return list(self.collection.find(
                {'customerId': ObjectId(customer_id)}
            ).sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding calls by customer: {e}", exc_info=True)
            raise
    
    def find_by_recording_sid(self, recording_sid):
        """Find call by recording SID"""
        try:
            return self.collection.find_one({'recordingSid': recording_sid})
        except Exception as e:
            logger.error(f"Error finding call by recording SID: {e}", exc_info=True)
            raise
    
    def find_one(self, query):
        """Find a single call"""
        try:
            return self.collection.find_one(query)
        except Exception as e:
            logger.error(f"Error finding call: {e}", exc_info=True)
            raise
    
    def find_all(self, limit=100):
        """Find all calls"""
        try:
            return list(self.collection.find().sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding all calls: {e}", exc_info=True)
            raise
    
    def update(self, call_id, update_data):
        """Update call record"""
        try:
            update_data['updatedAt'] = datetime.utcnow()
            
            result = self.collection.update_one(
                {'_id': ObjectId(call_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating call: {e}", exc_info=True)
            raise
    
    def find_by_emotion(self, emotion_label, limit=50):
        """Find calls by emotion"""
        try:
            return list(self.collection.find(
                {'emotionLabel': emotion_label}
            ).sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding calls by emotion: {e}", exc_info=True)
            raise
    
    def find_by_issue_category(self, category, limit=50):
        """Find calls by issue category"""
        try:
            return list(self.collection.find(
                {'issueCategory': category}
            ).sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding calls by category: {e}", exc_info=True)
            raise

    # ------------------------------------------------------------------
    # DRL routing support
    # ------------------------------------------------------------------

    def update_routing_reward(self, call_id, reward, routed_by='drl', routing_state=None):
        """Store the routing reward for a completed call."""
        try:
            update = {
                'routingReward': reward,
                'routedBy': routed_by,
                'updatedAt': datetime.utcnow(),
            }
            if routing_state is not None:
                update['routingState'] = routing_state
            self.collection.update_one(
                {'_id': ObjectId(call_id)},
                {'$set': update}
            )
        except Exception as e:
            logger.error(f"Error updating routing reward: {e}", exc_info=True)

    def find_recent_by_customer_and_category(self, customer_id, category, days=7, limit=5):
        """Find recent calls for same customer + category (for repeat-call detection)."""
        try:
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(days=days)
            return list(self.collection.find({
                'customerId': ObjectId(customer_id),
                'issueCategory': category,
                'createdAt': {'$gte': cutoff},
            }).sort('createdAt', -1).limit(limit))
        except Exception as e:
            logger.error(f"Error finding recent calls by category: {e}", exc_info=True)
            return []

    def get_routing_stats(self, limit=500):
        """Aggregate routing decision statistics."""
        try:
            pipeline = [
                {'$match': {'routedBy': {'$exists': True}}},
                {'$sort': {'createdAt': -1}},
                {'$limit': limit},
                {'$group': {
                    '_id': '$routedBy',
                    'count': {'$sum': 1},
                    'avgReward': {'$avg': '$routingReward'},
                }},
            ]
            return list(self.collection.aggregate(pipeline))
        except Exception as e:
            logger.error(f"Error getting routing stats: {e}", exc_info=True)
            return []


# Initialize model
try:
    calls_model = CallsModel()
except Exception as e:
    logger.error(f"Failed to initialize CallsModel: {e}")
    calls_model = None

# Initialize model
try:
    calls_model = CallsModel()
except Exception as e:
    logger.error(f"Failed to initialize CallsModel: {e}")
    calls_model = None