from utils.db import get_db
from datetime import datetime
from bson.objectid import ObjectId
import logging

logger = logging.getLogger(__name__)

VALID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']
VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
VALID_CATEGORIES = ['Bug', 'Feature Request', 'General']


class IssueModel:
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
            self.collection = self.db['issues']

            # Create indexes (idempotent)
            try:
                self.collection.create_index('userId')
                self.collection.create_index('status')
                self.collection.create_index('priority')
                self.collection.create_index('createdAt')
                logger.info("Issue collection indexes created successfully")
            except Exception as e:
                logger.warning(f"Index creation warning: {e}")

            logger.info("IssueModel initialized successfully")
            self._initialized = True

        except Exception as e:
            logger.error(f"Failed to initialize IssueModel: {e}", exc_info=True)
            raise

    def create_issue(self, data):
        """Create a new issue/bug report"""
        try:
            issue = {
                'userId': ObjectId(data['userId']),
                'title': data['title'],
                'description': data.get('description', ''),
                'category': data.get('category', 'Bug'),
                'priority': data.get('priority', 'Medium'),
                'status': 'Open',
                'assignedAgentId': None,
                'createdAt': datetime.utcnow(),
                'updatedAt': datetime.utcnow(),
            }
            result = self.collection.insert_one(issue)
            logger.info(f"Issue created with ID: {result.inserted_id}")
            return result.inserted_id
        except Exception as e:
            logger.error(f"Error creating issue: {e}", exc_info=True)
            raise

    def find_by_user(self, user_id):
        """Find all issues submitted by a specific user"""
        try:
            return list(
                self.collection.find({'userId': ObjectId(user_id)})
                .sort('createdAt', -1)
            )
        except Exception as e:
            logger.error(f"Error finding issues by user: {e}", exc_info=True)
            raise

    def find_all(self, filters=None):
        """Find all issues, optionally filtered by status/priority"""
        try:
            query = {}
            if filters:
                if filters.get('status'):
                    query['status'] = filters['status']
                if filters.get('priority'):
                    query['priority'] = filters['priority']
            return list(
                self.collection.find(query).sort('createdAt', -1)
            )
        except Exception as e:
            logger.error(f"Error finding all issues: {e}", exc_info=True)
            raise

    def find_by_id(self, issue_id):
        """Find a single issue by ID"""
        try:
            return self.collection.find_one({'_id': ObjectId(issue_id)})
        except Exception as e:
            logger.error(f"Error finding issue by ID: {e}", exc_info=True)
            raise

    def update_status(self, issue_id, status, agent_id=None):
        """Update the status of an issue"""
        try:
            update_data = {
                'status': status,
                'updatedAt': datetime.utcnow(),
            }
            if agent_id:
                update_data['assignedAgentId'] = ObjectId(agent_id)

            result = self.collection.update_one(
                {'_id': ObjectId(issue_id)},
                {'$set': update_data}
            )
            return result.modified_count > 0
        except Exception as e:
            logger.error(f"Error updating issue status: {e}", exc_info=True)
            raise


# Initialize singleton
try:
    issue_model = IssueModel()
except Exception as e:
    logger.error(f"Failed to initialize IssueModel singleton: {e}")
    issue_model = None
