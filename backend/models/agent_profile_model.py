from utils.db import get_db
from datetime import datetime
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

# Default agent profile template
DEFAULT_PROFILE = {
    'skills': ['general'],
    'specialization': 'General',
    'avgResolutionTime': 0.0,
    'totalCalls': 0,
    'resolvedCalls': 0,
    'avgSatisfactionScore': 0.5,
    'currentLoad': 0,
}


class AgentProfileModel:
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
            self.collection = self.db['agent_profiles']

            try:
                self.collection.create_index('agentId', unique=True)
                logger.info("AgentProfile collection indexes created successfully")
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")

            logger.info("AgentProfileModel initialized successfully")
            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize AgentProfileModel: {e}", exc_info=True)
            raise

    def find_or_create(self, agent_id):
        """Find agent profile or create a default one."""
        try:
            profile = self.collection.find_one({'agentId': ObjectId(agent_id)})
            if profile:
                return profile

            profile = {
                **DEFAULT_PROFILE,
                'agentId': ObjectId(agent_id),
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow(),
            }
            self.collection.insert_one(profile)
            logger.info(f"Created default agent profile for {agent_id}")
            return self.collection.find_one({'agentId': ObjectId(agent_id)})

        except Exception as e:
            logger.error(f"Error in find_or_create: {e}", exc_info=True)
            raise

    def get_by_agent(self, agent_id):
        """Get profile by agent ID."""
        try:
            return self.collection.find_one({'agentId': ObjectId(agent_id)})
        except Exception as e:
            logger.error(f"Error getting agent profile: {e}", exc_info=True)
            return None

    def find_all_online(self, online_agent_ids):
        """Get profiles for all agents in the given list of IDs.
        Creates default profiles for agents that don't have one yet.
        """
        try:
            if not online_agent_ids:
                return []

            object_ids = []
            for aid in online_agent_ids:
                try:
                    object_ids.append(ObjectId(aid))
                except Exception:
                    continue

            if not object_ids:
                return []

            # Ensure profiles exist for all online agents
            existing = list(self.collection.find({'agentId': {'$in': object_ids}}))
            existing_ids = {str(p['agentId']) for p in existing}

            for aid in online_agent_ids:
                if aid not in existing_ids:
                    self.find_or_create(aid)

            return list(self.collection.find({'agentId': {'$in': object_ids}}))

        except Exception as e:
            logger.error(f"Error finding online agent profiles: {e}", exc_info=True)
            return []

    def update_after_call(self, agent_id, call_result):
        """Update agent profile metrics after a completed call.

        call_result dict keys:
            - resolved: bool
            - satisfaction_score: float 0-1
            - resolution_time: float seconds
            - escalated: bool
        """
        try:
            profile = self.find_or_create(agent_id)

            total = profile.get('totalCalls', 0) + 1
            resolved = profile.get('resolvedCalls', 0) + (1 if call_result.get('resolved') else 0)

            # Rolling average for satisfaction
            prev_sat = profile.get('avgSatisfactionScore', 0.5)
            new_sat = call_result.get('satisfaction_score', 0.5)
            avg_sat = prev_sat + (new_sat - prev_sat) / total

            # Rolling average for resolution time
            prev_time = profile.get('avgResolutionTime', 0.0)
            new_time = call_result.get('resolution_time', 0.0)
            avg_time = prev_time + (new_time - prev_time) / total

            update = {
                'totalCalls': total,
                'resolvedCalls': resolved,
                'avgSatisfactionScore': round(avg_sat, 4),
                'avgResolutionTime': round(avg_time, 2),
                'updatedAt': datetime.utcnow(),
            }

            self.collection.update_one(
                {'agentId': ObjectId(agent_id)},
                {'$set': update}
            )
            logger.info(f"Updated agent profile for {agent_id}: total={total}, resolved={resolved}")
            return True

        except Exception as e:
            logger.error(f"Error updating agent profile: {e}", exc_info=True)
            return False

    def increment_load(self, agent_id):
        """Increment current load when a call is assigned."""
        try:
            self.find_or_create(agent_id)
            self.collection.update_one(
                {'agentId': ObjectId(agent_id)},
                {'$inc': {'currentLoad': 1}, '$set': {'updatedAt': datetime.utcnow()}}
            )
        except Exception as e:
            logger.error(f"Error incrementing agent load: {e}")

    def decrement_load(self, agent_id):
        """Decrement current load when a call ends."""
        try:
            self.collection.update_one(
                {'agentId': ObjectId(agent_id)},
                {'$inc': {'currentLoad': -1}, '$set': {'updatedAt': datetime.utcnow()}}
            )
            # Ensure load doesn't go negative
            self.collection.update_one(
                {'agentId': ObjectId(agent_id), 'currentLoad': {'$lt': 0}},
                {'$set': {'currentLoad': 0}}
            )
        except Exception as e:
            logger.error(f"Error decrementing agent load: {e}")

    def update_skills(self, agent_id, skills, specialization=None):
        """Update agent skills and specialization."""
        try:
            update = {'skills': skills, 'updatedAt': datetime.utcnow()}
            if specialization:
                update['specialization'] = specialization

            self.find_or_create(agent_id)
            self.collection.update_one(
                {'agentId': ObjectId(agent_id)},
                {'$set': update}
            )
            return True
        except Exception as e:
            logger.error(f"Error updating agent skills: {e}", exc_info=True)
            return False


# Initialize singleton
try:
    agent_profile_model = AgentProfileModel()
except Exception as e:
    logger.error(f"Failed to initialize AgentProfileModel singleton: {e}")
    agent_profile_model = None
