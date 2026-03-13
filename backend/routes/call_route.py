from flask import Blueprint
from controllers.call_controller import (
    generate_token,
    register_agent,
    unregister_agent,
    get_available_agent,
    handle_voice_webhook,
    handle_dial_status,
    handle_recording_callback,
    get_call_status,
    get_all_recordings,
    get_recording,
    get_user_recordings,
    get_agent_recordings,
    update_recording_ticket_status,
    process_recording_with_ai,
    get_unprocessed_recordings,
    get_customer_calls,
    get_calls_by_emotion,
    get_calls_by_category,
    get_customer_history_by_phone,
    update_agent_skills,
    get_routing_stats,
    migrate_agents,
)
from middleware.is_authenticated import is_authenticated

call_bp = Blueprint('call', __name__)

# Generate token for WebRTC client
@call_bp.route('/token/<role>', methods=['GET'])
@is_authenticated
def token(role):
    return generate_token(role)

# Agent availability
@call_bp.route('/register-agent', methods=['POST'])
@is_authenticated
def register():
    return register_agent()

@call_bp.route('/unregister-agent', methods=['POST'])
@is_authenticated
def unregister():
    return unregister_agent()

@call_bp.route('/available-agent', methods=['GET'])
@is_authenticated
def available_agent():
    return get_available_agent()

# Twilio webhooks
@call_bp.route('/voice', methods=['POST'])
def voice():
    return handle_voice_webhook()

@call_bp.route('/dial-status', methods=['POST'])
def dial_status():
    return handle_dial_status()

@call_bp.route('/recording', methods=['POST'])
def recording():
    return handle_recording_callback()

# Call status
@call_bp.route('/status/<call_sid>', methods=['GET'])
def status(call_sid):
    return get_call_status(call_sid)

# Recordings
@call_bp.route('/recordings', methods=['GET'])
def recordings():
    return get_all_recordings()

@call_bp.route('/recordings/unprocessed', methods=['GET'])
@is_authenticated
def unprocessed_recordings():
    return get_unprocessed_recordings()

@call_bp.route('/recordings/user/<user_id>', methods=['GET'])
@is_authenticated
def user_recordings(user_id):
    return get_user_recordings(user_id)

@call_bp.route('/recordings/agent/<agent_id>', methods=['GET'])
@is_authenticated
def agent_recordings(agent_id):
    return get_agent_recordings(agent_id)

@call_bp.route('/recordings/<recording_sid>', methods=['GET'])
def single_recording(recording_sid):
    return get_recording(recording_sid)

@call_bp.route('/recordings/<recording_sid>/status', methods=['PATCH'])
@is_authenticated
def update_status(recording_sid):
    return update_recording_ticket_status(recording_sid)

# Process recording with AI
@call_bp.route('/recordings/<recording_sid>/process-ai', methods=['POST'])
@is_authenticated
def process_ai(recording_sid):
    return process_recording_with_ai(recording_sid)

# Analyzed Calls (from calls table)
@call_bp.route('/calls/customer/<user_id>', methods=['GET'])
@is_authenticated
def customer_calls(user_id):
    return get_customer_calls(user_id)

@call_bp.route('/calls/emotion/<emotion_label>', methods=['GET'])
def calls_by_emotion(emotion_label):
    return get_calls_by_emotion(emotion_label)

@call_bp.route('/calls/category/<category>', methods=['GET'])
def calls_by_category(category):
    return get_calls_by_category(category)

# Customer history
@call_bp.route('/customer-history/<phone_number>', methods=['GET'])
def customer_history(phone_number):
    return get_customer_history_by_phone(phone_number)

# DRL routing — admin endpoints
@call_bp.route('/agent/<agent_id>/skills', methods=['PATCH'])
@is_authenticated
def agent_skills(agent_id):
    return update_agent_skills(agent_id)

@call_bp.route('/routing-stats', methods=['GET'])
@is_authenticated
def routing_stats():
    return get_routing_stats()

@call_bp.route('/migrate-agents', methods=['POST'])
@is_authenticated
def migrate():
    return migrate_agents()