from pymongo.errors import ServerSelectionTimeoutError
import os
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

# Global MongoDB client instance (singleton pattern with connection pooling)
_db_client = None
_db_instance = None

def get_db_client():
    """
    Get or create MongoDB client with connection pooling.
    Uses singleton pattern to ensure only one client instance.
    """
    global _db_client
    
    if _db_client is not None:
        return _db_client
    
    try:
        logger.info("Creating MongoDB client with connection pooling...")
        
        mongo_uri = os.getenv('MONGO_URI')
        if not mongo_uri:
            raise ValueError("MONGO_URI environment variable is not set")
        
        # Connection pooling configuration
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=5000,
            retryWrites=True if os.getenv('FLASK_ENV') != 'development' else False,
            tlsAllowInvalidCertificates=True if os.getenv('FLASK_ENV') == 'development' else False,
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=45000
        )
        
        # Verify connection
        client.admin.command('ping')
        logger.info("✅ MongoDB connected successfully with connection pooling")
        _db_client = client
        return _db_client
        
    except ServerSelectionTimeoutError as error:
        logger.error(f"❌ MongoDB connection failed: {error}")
        raise
    except Exception as error:
        logger.error(f"❌ MongoDB connection error: {error}")
        raise

def get_db():
    """Get MongoDB database instance"""
    global _db_instance
    
    if _db_instance is not None:
        return _db_instance
    
    client = get_db_client()
    _db_instance = client['clarity']
    return _db_instance

def connect_db():
    """Connect to MongoDB with timeout handling (legacy support)"""
    return get_db_client()

def close_db():
    """Close MongoDB connection"""
    global _db_client
    if _db_client is not None:
        try:
            _db_client.close()
            logger.info("MongoDB connection closed")
            _db_client = None
        except Exception as e:
            logger.error(f"Error closing MongoDB connection: {e}")