from dotenv import load_dotenv
import os

load_dotenv()

from flask import Flask, request, jsonify
from models import db, Customer, Call
from services.stt_service import transcribe
from services.emotion_service import detect_emotion
from services.summary_service import summarize_with_context
from datetime import datetime

import logging
import re
import requests
from pathlib import Path
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



app = Flask(__name__)

# Database configuration
DATABASE_PATH = os.getenv("DATABASE_PATH", "sqlite:///database.db")
app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_PATH
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# Create recordings directory if it doesn't exist
RECORDINGS_DIR = Path("recordings")
RECORDINGS_DIR.mkdir(exist_ok=True)

# Utility functions
def validate_phone_number(phone):
    """Validate and normalize phone number"""
    if not phone:
        return None
    cleaned = re.sub(r'[\s\-\(\)]+', '', phone)
    if len(re.findall(r'\d', cleaned)) >= 10:
        return cleaned
    return None

def download_recording(recording_url):
    """Download recording from Twilio URL"""
    try:
        logger.info(f"Downloading recording from {recording_url}")
        response = requests.get(recording_url, timeout=30)
        response.raise_for_status()
        
        # Extract filename from URL
        parsed_url = urlparse(recording_url)
        filename = f"{datetime.utcnow().timestamp()}.wav"
        filepath = RECORDINGS_DIR / filename
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        logger.info(f"Recording saved to {filepath}")
        return str(filepath)
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download recording: {str(e)}")
        raise
    except IOError as e:
        logger.error(f"Failed to save recording: {str(e)}")
        raise

def process_call_data(phone, transcript, emotion_label, emotion_score, summary, audio_path):
    """Process and store call data"""
    try:
        with app.app_context():
            # Validate phone number
            validated_phone = validate_phone_number(phone)
            if not validated_phone:
                logger.warning(f"Invalid phone number: {phone}")
                validated_phone = phone
            
            # Find or create customer
            customer = Customer.query.filter_by(phone_number=validated_phone).first()
            if not customer:
                logger.info(f"Creating new customer: {validated_phone}")
                customer = Customer(phone_number=validated_phone)
                db.session.add(customer)
                db.session.flush()
            
            # Create call record
            call = Call(
                customer_id=customer.id,
                audio_path=audio_path,
                transcript=transcript,
                emotion_label=emotion_label,
                emotion_score=emotion_score,
                summary=summary,
                created_at=datetime.utcnow()
            )
            
            db.session.add(call)
            db.session.commit()
            
            logger.info(f"Call record created for customer {customer.id}")
            return {
                "call_id": call.id,
                "customer_id": customer.id,
                "transcript": transcript,
                "emotion": emotion_label,
                "emotion_score": emotion_score,
                "summary": summary
            }
    
    except Exception as e:
        logger.error(f"Error processing call data: {str(e)}", exc_info=True)
        db.session.rollback()
        raise

@app.route("/process-audio", methods=["POST"])
def process_audio():
    """
    Process audio file with phone number.
    Expects multipart/form-data with 'phone' and 'audio' fields.
    """
    try:
        if "phone" not in request.form:
            logger.warning("Missing phone parameter")
            return jsonify({"error": "Missing phone parameter"}), 400
        
        if "audio" not in request.files:
            logger.warning("Missing audio file")
            return jsonify({"error": "Missing audio file"}), 400
        
        phone = request.form.get("phone")
        audio_file = request.files.get("audio")
        
        if not audio_file.filename:
            logger.warning("Empty audio file")
            return jsonify({"error": "Empty audio file"}), 400
        
        logger.info(f"Processing audio from {phone}")
        
        # Save audio file
        filename = f"{datetime.utcnow().timestamp()}_{audio_file.filename}"
        filepath = RECORDINGS_DIR / filename
        audio_file.save(str(filepath))
        
        # Process audio
        logger.info(f"Transcribing audio: {filepath}")
        transcript = transcribe(str(filepath))
        
        if not transcript or transcript.strip() == "":
            logger.warning("Empty transcript generated")
            return jsonify({"error": "Could not transcribe audio"}), 400
        
        logger.info(f"Detecting emotion from transcript")
        emotion_label, emotion_score = detect_emotion(transcript)
        
        # Get previous summary for context
        validated_phone = validate_phone_number(phone) or phone
        with app.app_context():
            customer = Customer.query.filter_by(phone_number=validated_phone).first()
            previous_summary = None
            
            if customer:
                last_call = Call.query.filter_by(customer_id=customer.id)\
                    .order_by(Call.created_at.desc()).first()
                previous_summary = last_call.summary if last_call else None
        
        logger.info(f"Generating summary with context")
        summary = summarize_with_context(transcript, previous_summary)
        
        # Store results
        result = process_call_data(
            phone=phone,
            transcript=transcript,
            emotion_label=emotion_label,
            emotion_score=emotion_score,
            summary=summary,
            audio_path=str(filepath)
        )
        
        logger.info(f"Audio processing completed for {phone}")
        return jsonify(result), 200
    
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/process-recording", methods=["POST"])
def process_recording():
    """
    Async endpoint to process recordings from Twilio.
    Expects JSON with recording_url, phone, call_sid, etc.
    """
    try:
        data = request.get_json()
        
        if not data:
            logger.warning("No JSON data provided")
            return jsonify({"error": "No data provided"}), 400
        
        recording_url = data.get("recording_url")
        phone = data.get("phone", "unknown")
        call_sid = data.get("call_sid", "")
        recording_sid = data.get("recording_sid", "")
        
        if not recording_url:
            logger.warning("Missing recording_url")
            return jsonify({"error": "Missing recording_url"}), 400
        
        logger.info(f"Processing recording: {recording_sid} from {phone}")
        
        # Download recording
        audio_path = download_recording(recording_url)
        
        # Transcribe
        logger.info(f"Transcribing recording {recording_sid}")
        transcript = transcribe(audio_path)
        
        if not transcript or transcript.strip() == "":
            logger.warning(f"Empty transcript for recording {recording_sid}")
            # Still store the record even with empty transcript
            transcript = "[No speech detected]"
        
        # Detect emotion
        logger.info(f"Detecting emotion for recording {recording_sid}")
        emotion_label, emotion_score = detect_emotion(transcript)
        
        # Get context from previous calls
        validated_phone = validate_phone_number(phone) or phone
        with app.app_context():
            customer = Customer.query.filter_by(phone_number=validated_phone).first()
            previous_summary = None
            
            if customer:
                last_call = Call.query.filter_by(customer_id=customer.id)\
                    .order_by(Call.created_at.desc()).first()
                previous_summary = last_call.summary if last_call else None
        
        # Generate summary
        logger.info(f"Generating summary for recording {recording_sid}")
        summary = summarize_with_context(transcript, previous_summary)
        
        # Store results
        result = process_call_data(
            phone=phone,
            transcript=transcript,
            emotion_label=emotion_label,
            emotion_score=emotion_score,
            summary=summary,
            audio_path=audio_path
        )
        
        logger.info(f"Recording {recording_sid} processed successfully")
        return jsonify({**result, "recording_sid": recording_sid}), 200
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download recording: {str(e)}")
        return jsonify({"error": "Failed to download recording"}), 502
    except Exception as e:
        logger.error(f"Error processing recording: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/customer/<phone>", methods=["GET"])
def get_customer_calls(phone):
    """Get all calls for a customer by phone number"""
    try:
        validated_phone = validate_phone_number(phone)
        if not validated_phone:
            logger.warning(f"Invalid phone: {phone}")
            return jsonify({"error": "Invalid phone number"}), 400
        
        with app.app_context():
            customer = Customer.query.filter_by(phone_number=validated_phone).first()
            if not customer:
                logger.info(f"Customer not found: {validated_phone}")
                return jsonify({"error": "Customer not found"}), 404
            
            calls = Call.query.filter_by(customer_id=customer.id)\
                .order_by(Call.created_at.desc()).all()
            
            return jsonify({
                "customer_id": customer.id,
                "phone_number": customer.phone_number,
                "first_seen": customer.first_seen.isoformat(),
                "call_count": len(calls),
                "calls": [
                    {
                        "id": call.id,
                        "transcript": call.transcript,
                        "emotion": call.emotion_label,
                        "emotion_score": call.emotion_score,
                        "summary": call.summary,
                        "created_at": call.created_at.isoformat()
                    }
                    for call in calls
                ]
            }), 200
    
    except Exception as e:
        logger.error(f"Error fetching customer calls: {str(e)}", exc_info=True)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    try:
        with app.app_context():
            # Test database connection
            db.session.execute("SELECT 1")
        
        return jsonify({
            "status": "healthy",
            "service": "Clarity Processing Engine",
            "timestamp": datetime.utcnow().isoformat()
        }), 200
    
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    logger.warning(f"404: {request.path}")
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

# Database initialization
def init_db():
    """Initialize database"""
    try:
        with app.app_context():
            db.create_all()
            logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    try:
        init_db()
        port = int(os.getenv("MAIN_PORT", 5001))
        debug = os.getenv("FLASK_ENV") == "development"
        logger.info(f"Starting processing engine on port {port}")
        app.run(host="0.0.0.0", port=port, debug=debug)
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}", exc_info=True)
        raise