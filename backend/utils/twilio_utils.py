from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from twilio.twiml.voice_response import VoiceResponse
import os
import logging

logger = logging.getLogger(__name__)

def get_twilio_client():
    """Get Twilio client"""
    return Client(
        os.getenv('TWILIO_ACCOUNT_SID'),
        os.getenv('TWILIO_AUTH_TOKEN')
    )

def generate_access_token(identity, role):
    """Generate Twilio access token"""
    account_sid = os.getenv('TWILIO_ACCOUNT_SID')
    api_key = os.getenv('TWILIO_API_KEY')
    api_secret = os.getenv('TWILIO_API_SECRET')
    twiml_app_sid = os.getenv('TWIML_APP_SID')
    
    token = AccessToken(account_sid, api_key, api_secret, identity=identity)
    
    voice_grant = VoiceGrant(
        outgoing_application_sid=twiml_app_sid,
        incoming_allow=True
    )
    token.add_grant(voice_grant)
    
    return token.to_jwt()

def create_voice_response(say_text=None, options=None):
    """Create TwiML voice response with proper recording and callbacks"""
    response = VoiceResponse()
    
    if options:
        # Get base URL for callbacks
        base_url = options.get('base_url', os.getenv('BASE_URL', 'https://79a3-2409-408d-307-561d-6d50-b556-9881-65a1.ngrok-free.app'))
        
        # Build dial with recording and callbacks
        dial_kwargs = {
            'record': options.get('record', 'record-from-answer'),
            'recording_status_callback': options.get('recording_status_callback'),
            'recording_status_callback_event': 'completed',  # Only on completion
            'action': options.get('dial_status_callback'),  # This is the status callback
            'method': 'POST',
            'timeout': options.get('timeout', 30)
        }
        
        logger.info(f"Creating dial with options: {dial_kwargs}")
        
        dial = response.dial(**dial_kwargs)
        dial.client(options.get('dial_to'))
        
    elif say_text:
        response.say(say_text)
    
    twiml_str = str(response)
    logger.info(f"Generated TwiML: {twiml_str}")
    
    return twiml_str

def extract_id_from_identity(identity, role_filter):
    """Extract user ID from identity string"""
    if isinstance(role_filter, list):
        for role in role_filter:
            if identity.startswith(role):
                return identity.split('_')[-1]
        return None
    else:
        if identity.startswith(role_filter):
            return identity.split('_')[-1]
        return None