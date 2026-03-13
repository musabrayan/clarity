from utils.db import get_db
from datetime import datetime
from bson.objectid import ObjectId
import logging
import random
import math

logger = logging.getLogger(__name__)

# Priority exponent for prioritized sampling
PRIORITY_ALPHA = 0.6


class RoutingExperienceModel:
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
            self.collection = self.db['routing_experiences']

            try:
                self.collection.create_index('createdAt')
                self.collection.create_index('priority')
                self.collection.create_index('customerId')
                logger.info("RoutingExperience collection indexes created successfully")
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")

            logger.info("RoutingExperienceModel initialized successfully")
            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize RoutingExperienceModel: {e}", exc_info=True)
            raise

    def store_experience(self, state, action_index, reward, next_state, done,
                         customer_id=None, agent_id=None):
        """Store an experience with priority = |reward|."""
        try:
            priority = abs(reward) + 1e-6  # small epsilon to avoid zero priority

            experience = {
                'state': state,            # list of floats/ints
                'actionIndex': action_index,
                'reward': reward,
                'nextState': next_state,    # list of floats/ints
                'done': done,
                'priority': priority,
                'customerId': str(customer_id) if customer_id else None,
                'agentId': str(agent_id) if agent_id else None,
                'createdAt': datetime.utcnow(),
            }

            result = self.collection.insert_one(experience)
            logger.info(f"Stored routing experience with priority {priority:.4f}")
            return result.inserted_id

        except Exception as e:
            logger.error(f"Error storing experience: {e}", exc_info=True)
            return None

    def sample_batch(self, batch_size=32):
        """Sample a batch using prioritized experience replay.

        Probabilities are proportional to priority^alpha.
        Returns (experiences, weights) where weights are importance-sampling corrections.
        """
        try:
            total = self.collection.count_documents({})
            if total == 0:
                return [], []

            actual_batch = min(batch_size, total)

            # Fetch all experiences (for datasets up to ~10k this is fine;
            # for larger datasets, consider a reservoir-sampling approach)
            all_experiences = list(self.collection.find().sort('priority', -1).limit(5000))

            if not all_experiences:
                return [], []

            # Compute sampling probabilities
            priorities = [exp.get('priority', 1e-6) for exp in all_experiences]
            powered = [p ** PRIORITY_ALPHA for p in priorities]
            total_powered = sum(powered)
            probabilities = [p / total_powered for p in powered]

            # Weighted random sampling without replacement
            indices = list(range(len(all_experiences)))
            sampled_indices = []
            remaining_probs = list(probabilities)
            remaining_indices = list(indices)

            for _ in range(min(actual_batch, len(all_experiences))):
                total_p = sum(remaining_probs)
                if total_p <= 0:
                    break
                normalized = [p / total_p for p in remaining_probs]
                r = random.random()
                cumsum = 0.0
                chosen = 0
                for i, p in enumerate(normalized):
                    cumsum += p
                    if r <= cumsum:
                        chosen = i
                        break

                sampled_indices.append(remaining_indices[chosen])
                remaining_indices.pop(chosen)
                remaining_probs.pop(chosen)

            sampled = [all_experiences[i] for i in sampled_indices]

            # Importance sampling weights (normalized)
            n = len(all_experiences)
            weights = []
            for i in sampled_indices:
                w = (1.0 / (n * probabilities[i])) if probabilities[i] > 0 else 1.0
                weights.append(w)

            # Normalize weights
            max_w = max(weights) if weights else 1.0
            weights = [w / max_w for w in weights]

            logger.info(f"Sampled {len(sampled)} experiences with prioritized replay")
            return sampled, weights

        except Exception as e:
            logger.error(f"Error sampling batch: {e}", exc_info=True)
            return [], []

    def count(self):
        """Count total stored experiences."""
        try:
            return self.collection.count_documents({})
        except Exception as e:
            logger.error(f"Error counting experiences: {e}")
            return 0

    def get_stats(self):
        """Get replay buffer statistics."""
        try:
            total = self.count()
            if total == 0:
                return {'total': 0, 'avg_reward': 0, 'avg_priority': 0}

            pipeline = [
                {'$group': {
                    '_id': None,
                    'avgReward': {'$avg': '$reward'},
                    'avgPriority': {'$avg': '$priority'},
                    'maxReward': {'$max': '$reward'},
                    'minReward': {'$min': '$reward'},
                }}
            ]
            result = list(self.collection.aggregate(pipeline))

            if result:
                stats = result[0]
                return {
                    'total': total,
                    'avg_reward': round(stats.get('avgReward', 0), 4),
                    'avg_priority': round(stats.get('avgPriority', 0), 4),
                    'max_reward': round(stats.get('maxReward', 0), 4),
                    'min_reward': round(stats.get('minReward', 0), 4),
                }
            return {'total': total}

        except Exception as e:
            logger.error(f"Error getting replay stats: {e}")
            return {'total': 0, 'error': str(e)}


# Initialize singleton
try:
    routing_experience_model = RoutingExperienceModel()
except Exception as e:
    logger.error(f"Failed to initialize RoutingExperienceModel singleton: {e}")
    routing_experience_model = None
