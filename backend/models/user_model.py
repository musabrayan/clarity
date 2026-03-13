from utils.db import get_db
from datetime import datetime
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

# Default skill vector for agents — neutral proficiency across all categories
DEFAULT_SKILL_VECTOR = {
    'Sales': 0.5,
    'Technical': 0.5,
    'Billing': 0.5,
    'General': 0.5,
    'Other': 0.5,
}

DEFAULT_PERFORMANCE_METRICS = {
    'avg_resolution_rate': 0.0,
    'avg_handle_time': 0.0,
    'avg_satisfaction': 0.5,
}


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
        try:
            return self.collection.find_one({'_id': ObjectId(user_id)})
        except Exception as e:
            logger.error(f"Error finding user by ID: {e}", exc_info=True)
            raise
    
    def find_by_ids(self, user_ids):
        """Find multiple users by IDs. Returns dict mapping str(id) -> user doc."""
        try:
            if not user_ids:
                return {}
            object_ids = []
            for uid in user_ids:
                try:
                    object_ids.append(ObjectId(uid))
                except Exception:
                    continue
            if not object_ids:
                return {}
            users = self.collection.find({'_id': {'$in': object_ids}})
            return {str(u['_id']): u for u in users}
        except Exception as e:
            logger.error(f"Error finding users by IDs: {e}", exc_info=True)
            return {}
    
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

    # ------------------------------------------------------------------
    # Agent skill / workload / performance helpers (DRL routing support)
    # ------------------------------------------------------------------

    def get_agent_profile(self, agent_id):
        """Return agent doc with guaranteed skill_vector, workload, and
        performance_metrics fields (fills defaults for legacy docs)."""
        try:
            doc = self.collection.find_one({'_id': ObjectId(agent_id)})
            if not doc:
                return None
            if 'skill_vector' not in doc:
                doc['skill_vector'] = dict(DEFAULT_SKILL_VECTOR)
            if 'current_workload' not in doc:
                doc['current_workload'] = 0
            if 'performance_metrics' not in doc:
                doc['performance_metrics'] = dict(DEFAULT_PERFORMANCE_METRICS)
            if 'total_calls_handled' not in doc:
                doc['total_calls_handled'] = 0
            if 'total_resolved' not in doc:
                doc['total_resolved'] = 0
            if 'total_escalated' not in doc:
                doc['total_escalated'] = 0
            return doc
        except Exception as e:
            logger.error(f"Error fetching agent profile: {e}", exc_info=True)
            raise

    def get_agent_profiles(self, agent_ids):
        """Batch-fetch agent profiles with defaults filled in."""
        try:
            if not agent_ids:
                return {}
            oids = [ObjectId(a) for a in agent_ids]
            docs = list(self.collection.find({'_id': {'$in': oids}}))
            result = {}
            for doc in docs:
                if 'skill_vector' not in doc:
                    doc['skill_vector'] = dict(DEFAULT_SKILL_VECTOR)
                if 'current_workload' not in doc:
                    doc['current_workload'] = 0
                if 'performance_metrics' not in doc:
                    doc['performance_metrics'] = dict(DEFAULT_PERFORMANCE_METRICS)
                if 'total_calls_handled' not in doc:
                    doc['total_calls_handled'] = 0
                if 'total_resolved' not in doc:
                    doc['total_resolved'] = 0
                if 'total_escalated' not in doc:
                    doc['total_escalated'] = 0
                result[str(doc['_id'])] = doc
            return result
        except Exception as e:
            logger.error(f"Error fetching agent profiles: {e}", exc_info=True)
            return {}

    def update_agent_skills(self, agent_id, skill_vector):
        """Set an agent's skill_vector (admin operation)."""
        try:
            result = self.collection.update_one(
                {'_id': ObjectId(agent_id)},
                {'$set': {'skill_vector': skill_vector, 'updatedAt': datetime.utcnow()}}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating agent skills: {e}", exc_info=True)
            raise

    def increment_workload(self, agent_id):
        """Increment current_workload by 1 when a call starts."""
        try:
            self.collection.update_one(
                {'_id': ObjectId(agent_id)},
                {'$inc': {'current_workload': 1}, '$set': {'updatedAt': datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Error incrementing workload: {e}", exc_info=True)

    def decrement_workload(self, agent_id):
        """Decrement current_workload by 1 (floor 0) when a call ends."""
        try:
            self.collection.update_one(
                {'_id': ObjectId(agent_id), 'current_workload': {'$gt': 0}},
                {'$inc': {'current_workload': -1}, '$set': {'updatedAt': datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Error decrementing workload: {e}", exc_info=True)

    def update_performance(self, agent_id, resolved, escalated, handle_time_sec):
        """Update running performance metrics after a call completes."""
        try:
            doc = self.collection.find_one({'_id': ObjectId(agent_id)})
            if not doc:
                return

            total = doc.get('total_calls_handled', 0) + 1
            total_resolved = doc.get('total_resolved', 0) + (1 if resolved else 0)
            total_escalated = doc.get('total_escalated', 0) + (1 if escalated else 0)

            pm = doc.get('performance_metrics', dict(DEFAULT_PERFORMANCE_METRICS))
            # Incremental mean update
            old_aht = pm.get('avg_handle_time', 0.0)
            new_aht = old_aht + (handle_time_sec - old_aht) / total
            new_res_rate = total_resolved / total if total else 0.0

            self.collection.update_one(
                {'_id': ObjectId(agent_id)},
                {'$set': {
                    'total_calls_handled': total,
                    'total_resolved': total_resolved,
                    'total_escalated': total_escalated,
                    'performance_metrics.avg_resolution_rate': round(new_res_rate, 4),
                    'performance_metrics.avg_handle_time': round(new_aht, 2),
                    'updatedAt': datetime.utcnow(),
                }}
            )
        except Exception as e:
            logger.error(f"Error updating performance: {e}", exc_info=True)

    def migrate_agents_defaults(self):
        """One-time migration: add default skill_vector, workload, and
        performance_metrics to all existing agents that lack them."""
        try:
            result = self.collection.update_many(
                {'role': 'agent', 'skill_vector': {'$exists': False}},
                {'$set': {
                    'skill_vector': dict(DEFAULT_SKILL_VECTOR),
                    'current_workload': 0,
                    'performance_metrics': dict(DEFAULT_PERFORMANCE_METRICS),
                    'total_calls_handled': 0,
                    'total_resolved': 0,
                    'total_escalated': 0,
                    'updatedAt': datetime.utcnow(),
                }}
            )
            logger.info(f"Migrated {result.modified_count} agents with default DRL fields")
            return result.modified_count
        except Exception as e:
            logger.error(f"Error migrating agents: {e}", exc_info=True)
            raise


# Initialize model
try:
    user_model = UserModel()
except Exception as e:
    logger.error(f"Failed to initialize UserModel singleton: {e}")
    user_model = None