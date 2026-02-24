import os
from datetime import timedelta

class Config:
    """Base configuration"""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key')
    JWT_SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    MONGO_URI = os.getenv('MONGO_URI')
    JSON_SORT_KEYS = False

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    # Add production-specific settings here

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    MONGO_URI = os.getenv('MONGO_TEST_URI', 'mongodb://localhost:27017/clarity_test')

# Select configuration based on environment
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get configuration based on FLASK_ENV"""
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])