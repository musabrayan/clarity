from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
import logging
import os
import sys

# Load environment variables
load_dotenv()

# Create app instance
app = Flask(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================
app.config['JWT_SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 hours

# MongoDB Configuration
MONGO_URI = os.getenv('MONGO_URI')
if not MONGO_URI:
    print("ERROR: MONGO_URI environment variable not set")
    sys.exit(1)

app.config['MONGO_URI'] = MONGO_URI

# Flask-PyMongo
from flask_pymongo import PyMongo
mongo = PyMongo(app)

# JWT Manager
jwt = JWTManager(app)

# ============================================================================
# LOGGING CONFIGURATION
# ============================================================================
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

logger = logging.getLogger(__name__)
logger.info(f"Starting Clarity Backend - Environment: {os.getenv('FLASK_ENV', 'development')}")

# ============================================================================
# CORS CONFIGURATION
# ============================================================================
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
CORS(app, 
     resources={r"/api/*": {
         "origins": [FRONTEND_URL],
         "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "max_age": 3600,
         "expose_headers": ["Content-Type", "Authorization"]
     }})

logger.info(f"CORS configured for origin: {FRONTEND_URL}")

# ============================================================================
# HEALTH CHECK ENDPOINT
# ============================================================================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        mongo.db.command('ping')
        return {
            'status': 'healthy',
            'environment': os.getenv('FLASK_ENV'),
            'service': 'clarity-backend'
        }, 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'status': 'unhealthy',
            'error': str(e)
        }, 503

# ============================================================================
# IMPORT ROUTES
# ============================================================================
try:
    from routes.user_route import user_bp
    from routes.call_route import call_bp
    
    app.register_blueprint(user_bp, url_prefix='/api/v1/user')
    app.register_blueprint(call_bp, url_prefix='/api/v1/call')
    
    logger.info("Routes registered successfully")
except Exception as e:
    logger.error(f"Failed to import routes: {e}", exc_info=True)
    sys.exit(1)

# ============================================================================
# ERROR HANDLERS
# ============================================================================
@app.errorhandler(404)
def not_found(error):
    return {
        'success': False,
        'message': 'Endpoint not found'
    }, 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}", exc_info=True)
    return {
        'success': False,
        'message': 'Internal server error'
    }, 500

@app.errorhandler(403)
def forbidden(error):
    return {
        'success': False,
        'message': 'Forbidden'
    }, 403

# ============================================================================
# BEFORE REQUEST
# ============================================================================
@app.before_request
def before_request():
    """Log incoming requests"""
    if os.getenv('FLASK_ENV') == 'development':
        from flask import request
        logger.debug(f"{request.method} {request.path}")


# ============================================================================
# MAIN
# ============================================================================
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') != 'production'
    
    # Import after app initialization to avoid circular imports
    from utils.db import close_db

    try:
        app.run(
            host='0.0.0.0',
            port=port,
            debug=debug,
            use_reloader=debug
        )
    finally:
        # Clean up database connections on shutdown
        logger.info("Application shutdown - database connections closed")
