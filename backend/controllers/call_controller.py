from flask import request, jsonify
from models.call_recording_model import call_recording_model
from models.calls_model import calls_model
from models.user_model import user_model
from utils.twilio_utils import (
    generate_access_token,
    create_voice_response,
    get_twilio_client,
    extract_id_from_identity
)
from utils.ai_processor import ai_processor
from bson.objectid import ObjectId
import os
import logging
import threading
import queue
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Store online agents in memory
online_agents = set()

# Thread pool for background tasks (replaces daemon threads)
_thread_pool = ThreadPoolExecutor(max_workers=5, thread_name_prefix="clarity_bg_")

# Task queue for safe shutdown
_task_queue = queue.Queue()

def generate_token(role):
    """Generate Twilio Access Token"""
    try:
        user_id = request.user_id
        
        if role not in ['agent', 'customer']:
            return jsonify({
                'success': False,
                'message': "Role must be either 'customer' or 'agent'"
            }), 400
        
        user = user_model.find_by_id(user_id)
        
        if not user:
            return jsonify({
                'success': False,
                'message': 'User not found'
            }), 404
        
        if role != user.get('role'):
            return jsonify({
                'success': False,
                'message': 'Role does not match authenticated user'
            }), 403
        
        identity = f"{role}_{user_id}"
        token = generate_access_token(identity, role)
        
        return jsonify({
            'success': True,
            'token': token,
            'identity': identity
        }), 200
    
    except Exception as error:
        logger.error(f"Error generating token: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to generate token',
            'error': str(error)
        }), 500

def register_agent():
    """Register agent as available"""
    try:
        user_id = request.user_id
        
        user = user_model.find_by_id(user_id)
        if not user or user.get('role') != 'agent':
            return jsonify({
                'success': False,
                'message': 'Only agents can register'
            }), 403
        
        online_agents.add(str(user_id))
        logger.info(f"Agent registered: {user_id}")
        
        return jsonify({
            'success': True,
            'agentId': str(user_id)
        }), 200
    
    except Exception as error:
        logger.error(f"Error registering agent: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to register agent',
            'error': str(error)
        }), 500

def unregister_agent():
    """Unregister agent"""
    try:
        user_id = request.user_id
        online_agents.discard(str(user_id))
        logger.info(f"Agent unregistered: {user_id}")
        
        return jsonify({
            'success': True
        }), 200
    
    except Exception as error:
        logger.error(f"Error unregistering agent: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to unregister agent',
            'error': str(error)
        }), 500

def get_available_agent():
    """Get an available agent"""
    try:
        agent_id = next(iter(online_agents)) if online_agents else None
        
        if not agent_id:
            return jsonify({
                'success': False,
                'message': 'No agents are currently online'
            }), 404
        
        return jsonify({
            'success': True,
            'agentId': agent_id,
            'identity': f'agent_{agent_id}'
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching available agent: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch available agent',
            'error': str(error)
        }), 500

def handle_voice_webhook():
    """Handle incoming voice calls"""
    try:
        to = request.form.get('To')
        from_number = request.form.get('From')
        call_sid = request.form.get('CallSid')
        
        logger.info(f"Voice webhook received - From: {from_number}, To: {to}, CallSid: {call_sid}")
        
        if not to:
            response_xml = create_voice_response("No destination specified")
            return response_xml, 200, {'Content-Type': 'application/xml'}
        
        base_url = os.getenv('BASE_URL', f"{request.scheme}://{request.host}")
        logger.info(f"Using base URL: {base_url}")
        
        recording_callback = f"{base_url}/api/v1/call/recording"
        dial_status_callback = f"{base_url}/api/v1/call/dial-status"
        
        response_xml = create_voice_response(None, {
            'base_url': base_url,
            'dial_to': to,
            'record': 'record-from-answer',
            'recording_status_callback': recording_callback,
            'dial_status_callback': dial_status_callback,
            'timeout': 30
        })
        
        logger.info(f"Voice webhook: routing to {to}")
        return response_xml, 200, {'Content-Type': 'application/xml'}
    
    except Exception as error:
        logger.error(f"Error handling voice webhook: {error}", exc_info=True)
        response_xml = create_voice_response("An error occurred. Please try again later.")
        return response_xml, 200, {'Content-Type': 'application/xml'}

def process_recording_background(recording_sid, recording_url, user_id, agent_id):
    """Background task to process recording asynchronously"""
    try:
        logger.info(f"=== BACKGROUND PROCESSING STARTED: {recording_sid} ===")
        
        recording = call_recording_model.find_one({'recordingSid': recording_sid})
        if not recording:
            logger.error(f"Recording not found: {recording_sid}")
            return
        
        # Get previous summary for context
        previous_summary = None
        if user_id:
            try:
                user_calls = calls_model.find_by_customer(user_id, limit=1)
                if user_calls:
                    previous_summary = user_calls[0].get('summary')
                    logger.info(f"Found previous summary for context")
            except Exception as e:
                logger.warning(f"Could not fetch previous summary: {e}")
        
        # Process with AI
        logger.info(f"Starting AI pipeline for {recording_sid}")
        result = ai_processor.process_full_pipeline(
            recording_url,
            recording_sid,
            previous_summary
        )
        
        if result['success']:
            logger.info(f"AI processing successful")
            
            # 1. Update call_recording with analysis
            call_recording_model.update_with_ai_analysis(recording_sid, result)
            logger.info(f"Updated call_recording: {recording_sid}")
            
            # 2. Create entry in calls table
            call_data = {
                'customerId': ObjectId(user_id) if user_id else None,
                'agentId': ObjectId(agent_id) if agent_id else None,
                'recordingSid': recording_sid,
                'transcript': result.get('transcript'),
                'emotionLabel': result.get('emotion_label'),
                'emotionScore': result.get('emotion_score'),
                'issueCategory': result.get('issue_category'),
                'expertiseLevel': result.get('expertise_level'),
                'resolutionStatus': result.get('resolution_status'),
                'summary': result.get('summary'),
                'bulletPoints': result.get('bullet_points'),
                'callSid': recording.get('callSid')
            }
            
            calls_model.create(call_data)
            logger.info(f"Created call record in calls table")
            logger.info(f"Emotion: {result.get('emotion_label')}, Category: {result.get('issue_category')}")
            
        else:
            logger.error(f"AI processing failed: {result.get('error')}")
    
    except Exception as e:
        logger.error(f"Error in background processing: {str(e)}", exc_info=True)

def handle_dial_status():
    """Handle dial status callback - triggers AI processing"""
    try:
        logger.info("=== DIAL STATUS WEBHOOK RECEIVED ===")
        logger.info(f"Request form data: {dict(request.form)}")
        
        dial_call_status = request.form.get('DialCallStatus')
        recording_url = request.form.get('RecordingUrl')
        recording_sid = request.form.get('RecordingSid')
        recording_duration = request.form.get('RecordingDuration')
        call_sid = request.form.get('CallSid')
        from_id = request.form.get('From')
        to_id = request.form.get('To')
        
        logger.info(f"Parsed dial status: {dial_call_status}")
        logger.info(f"Recording SID: {recording_sid}")
        logger.info(f"Recording URL: {recording_url}")
        
        response_message = ""
        
        if dial_call_status == 'completed':
            response_message = "Thank you for calling. Goodbye."
            
            # Save recording if available
            if recording_sid and recording_url:
                try:
                    logger.info("Attempting to save recording to database...")
                    
                    user_id = extract_id_from_identity(from_id, ['customer', 'user'])
                    agent_id = extract_id_from_identity(to_id, 'agent')
                    
                    logger.info(f"Extracted user_id: {user_id}, agent_id: {agent_id}")
                    
                    recording_data = {
                        'recordingSid': recording_sid,
                        'recordingUrl': recording_url,
                        'duration': int(recording_duration) if recording_duration else 0,
                        'callSid': call_sid,
                        'from': from_id,
                        'to': to_id,
                        'userId': ObjectId(user_id) if user_id else None,
                        'agentId': ObjectId(agent_id) if agent_id else None,
                        'status': 'completed',
                        'ticketStatus': 'Pending'
                    }
                    
                    result_id = call_recording_model.create(recording_data)
                    logger.info(f"Recording saved successfully with ID: {result_id}")
                    
                    # Trigger background AI processing using thread pool (managed)
                    logger.info("Submitting AI processing task to thread pool...")
                    _thread_pool.submit(
                        process_recording_background,
                        recording_sid,
                        recording_url,
                        user_id,
                        agent_id
                    )
                    logger.info("Background processing task submitted")
                
                except Exception as db_error:
                    logger.error(f"Failed to save recording: {db_error}", exc_info=True)
            else:
                logger.warning(f"Missing recording data - RecordingSid: {recording_sid}, RecordingUrl: {recording_url}")
        
        elif dial_call_status in ['no-answer', 'busy']:
            response_message = "Sorry, all agents are currently unavailable. Please try again later."
        
        elif dial_call_status in ['failed', 'canceled']:
            response_message = "We're sorry, but we're experiencing technical difficulties. Please try again later."
        
        else:
            response_message = "Thank you for calling. Goodbye."
        
        response_xml = create_voice_response(response_message)
        logger.info("=== DIAL STATUS RESPONSE SENT ===")
        return response_xml, 200, {'Content-Type': 'application/xml'}
    
    except Exception as error:
        logger.error(f"Error handling dial status: {error}", exc_info=True)
        response_xml = create_voice_response("Goodbye.")
        return response_xml, 200, {'Content-Type': 'application/xml'}

def handle_recording_callback():
    """Handle recording callback"""
    try:
        logger.info("=== RECORDING CALLBACK RECEIVED ===")
        logger.info(f"Request form data: {dict(request.form)}")
        
        return jsonify({
            'success': True,
            'message': 'Recording info received'
        }), 200
    
    except Exception as error:
        logger.error(f"Error handling recording callback: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to process recording',
            'error': str(error)
        }), 500

def get_call_status(call_sid):
    """Get call status from Twilio"""
    try:
        client = get_twilio_client()
        call = client.calls(call_sid).fetch()
        
        return jsonify({
            'success': True,
            'call': {
                'sid': call.sid,
                'status': call.status,
                'duration': call.duration,
                'from': call.from_,
                'to': call.to,
                'startTime': str(call.start_time),
                'endTime': str(call.end_time) if call.end_time else None
            }
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching call status: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch call status',
            'error': str(error)
        }), 500

def get_all_recordings():
    """Get all recordings"""
    try:
        recordings = call_recording_model.find_all(limit=50)
        
        for recording in recordings:
            recording['_id'] = str(recording['_id'])
            if recording.get('userId'):
                recording['userId'] = str(recording['userId'])
            if recording.get('agentId'):
                recording['agentId'] = str(recording['agentId'])
        
        logger.info(f"Retrieved {len(recordings)} total recordings")
        
        return jsonify({
            'success': True,
            'count': len(recordings),
            'recordings': recordings
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching recordings: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch recordings',
            'error': str(error)
        }), 500

def get_recording(recording_sid):
    """Get single recording"""
    try:
        recording = call_recording_model.find_one({'recordingSid': recording_sid})
        
        if not recording:
            return jsonify({
                'success': False,
                'message': 'Recording not found'
            }), 404
        
        recording['_id'] = str(recording['_id'])
        if recording.get('userId'):
            recording['userId'] = str(recording['userId'])
        if recording.get('agentId'):
            recording['agentId'] = str(recording['agentId'])
        
        return jsonify({
            'success': True,
            'recording': recording
        }, 200)
    
    except Exception as error:
        logger.error(f"Error fetching recording: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch recording',
            'error': str(error)
        }), 500

def get_user_recordings(user_id):
    """Get recordings for a user"""
    try:
        recordings = call_recording_model.find_by_user(user_id)
        
        for recording in recordings:
            recording['_id'] = str(recording['_id'])
            if recording.get('userId'):
                recording['userId'] = str(recording['userId'])
            if recording.get('agentId'):
                recording['agentId'] = str(recording['agentId'])
        
        logger.info(f"Retrieved {len(recordings)} recordings for user {user_id}")
        
        return jsonify({
            'success': True,
            'count': len(recordings),
            'recordings': recordings
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching user recordings: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch user recordings',
            'error': str(error)
        }), 500

def get_agent_recordings(agent_id):
    """Get recordings for an agent"""
    try:
        recordings = call_recording_model.find_by_agent(agent_id)
        
        for recording in recordings:
            recording['_id'] = str(recording['_id'])
            if recording.get('userId'):
                recording['userId'] = str(recording['userId'])
            if recording.get('agentId'):
                recording['agentId'] = str(recording['agentId'])
        
        logger.info(f"Retrieved {len(recordings)} recordings for agent {agent_id}")
        
        return jsonify({
            'success': True,
            'count': len(recordings),
            'recordings': recordings
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching agent recordings: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch agent recordings',
            'error': str(error)
        }), 500

def update_recording_ticket_status(recording_sid):
    """Update recording ticket status"""
    try:
        data = request.get_json()
        status = data.get('ticketStatus')
        
        if not status or status not in ['Pending', 'Resolved', 'Closed']:
            return jsonify({
                'success': False,
                'message': "Status must be 'Pending', 'Resolved', or 'Closed'"
            }), 400
        
        success = call_recording_model.update_ticket_status(recording_sid, status)
        
        if not success:
            return jsonify({
                'success': False,
                'message': 'Recording not found'
            }), 404
        
        logger.info(f"Recording status updated: {recording_sid} -> {status}")
        
        return jsonify({
            'success': True,
            'message': 'Recording status updated'
        }), 200
    
    except Exception as error:
        logger.error(f"Error updating ticket status: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to update ticket status',
            'error': str(error)
        }), 500

def process_recording_with_ai(recording_sid):
    """
    Endpoint to manually process a specific recording with AI
    """
    try:
        logger.info(f"=== AI PROCESSING STARTED FOR RECORDING: {recording_sid} ===")
        
        recording = call_recording_model.find_one({'recordingSid': recording_sid})
        
        if not recording:
            logger.error(f"Recording not found: {recording_sid}")
            return jsonify({
                'success': False,
                'message': 'Recording not found'
            }), 404
        
        logger.info(f"Found recording: {recording.get('recordingSid')}")
        
        if recording.get('aiProcessed'):
            logger.warning(f"Recording already processed: {recording_sid}")
            return jsonify({
                'success': False,
                'message': 'Recording already processed'
            }), 400
        
        previous_summary = None
        if recording.get('userId'):
            try:
                user_calls = calls_model.find_by_customer(str(recording['userId']), limit=1)
                if user_calls:
                    previous_summary = user_calls[0].get('summary')
            except Exception as e:
                logger.warning(f"Could not fetch previous summary: {e}")
        
        logger.info(f"Starting AI pipeline for recording {recording_sid}...")
        
        result = ai_processor.process_full_pipeline(
            recording.get('recordingUrl'),
            recording_sid,
            previous_summary
        )
        
        logger.info(f"AI Pipeline Result: {result}")
        
        if result['success']:
            logger.info("Updating database with AI analysis results...")
            call_recording_model.update_with_ai_analysis(recording_sid, result)
            
            # Create entry in calls table
            user_id = str(recording.get('userId')) if recording.get('userId') else None
            agent_id = str(recording.get('agentId')) if recording.get('agentId') else None
            
            call_data = {
                'customerId': ObjectId(user_id) if user_id else None,
                'agentId': ObjectId(agent_id) if agent_id else None,
                'recordingSid': recording_sid,
                'transcript': result.get('transcript'),
                'emotionLabel': result.get('emotion_label'),
                'emotionScore': result.get('emotion_score'),
                'issueCategory': result.get('issue_category'),
                'expertiseLevel': result.get('expertise_level'),
                'resolutionStatus': result.get('resolution_status'),
                'summary': result.get('summary'),
                'bulletPoints': result.get('bullet_points'),
                'callSid': recording.get('callSid')
            }
            
            calls_model.create(call_data)
            
            logger.info(f"Successfully processed recording: {recording_sid}")
            
            return jsonify({
                'success': True,
                'message': 'Recording processed successfully',
                'analysis': {
                    'transcript': result.get('transcript'),
                    'emotion_label': result.get('emotion_label'),
                    'emotion_score': result.get('emotion_score'),
                    'issue_category': result.get('issue_category'),
                    'expertise_level': result.get('expertise_level'),
                    'resolution_status': result.get('resolution_status'),
                    'summary': result.get('summary'),
                    'bullet_points': result.get('bullet_points')
                }
            }), 200
        else:
            logger.error(f"Failed to process recording {recording_sid}: {result.get('error')}")
            return jsonify({
                'success': False,
                'message': 'Failed to process recording',
                'error': result.get('error')
            }), 500
    
    except Exception as error:
        logger.error(f"Error processing recording: {error}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to process recording',
            'error': str(error)
        }), 500

def get_unprocessed_recordings():
    """Get all unprocessed recordings for batch processing"""
    try:
        recordings = call_recording_model.find_unprocessed_recordings(limit=50)
        
        for recording in recordings:
            recording['_id'] = str(recording['_id'])
            if recording.get('userId'):
                recording['userId'] = str(recording['userId'])
            if recording.get('agentId'):
                recording['agentId'] = str(recording['agentId'])
        
        logger.info(f"Found {len(recordings)} unprocessed recordings")
        
        return jsonify({
            'success': True,
            'count': len(recordings),
            'recordings': recordings
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching unprocessed recordings: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch unprocessed recordings',
            'error': str(error)
        }), 500

def get_customer_calls(user_id):
    """Get all analyzed calls for a customer"""
    try:
        calls = calls_model.find_by_customer(user_id)
        
        for call in calls:
            call['_id'] = str(call['_id'])
            if call.get('customerId'):
                call['customerId'] = str(call['customerId'])
            if call.get('agentId'):
                call['agentId'] = str(call['agentId'])
        
        logger.info(f"Retrieved {len(calls)} calls for customer {user_id}")
        
        return jsonify({
            'success': True,
            'count': len(calls),
            'calls': calls
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching customer calls: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch customer calls',
            'error': str(error)
        }), 500

def get_calls_by_emotion(emotion_label):
    """Get calls filtered by emotion"""
    try:
        calls = calls_model.find_by_emotion(emotion_label)
        
        for call in calls:
            call['_id'] = str(call['_id'])
            if call.get('customerId'):
                call['customerId'] = str(call['customerId'])
            if call.get('agentId'):
                call['agentId'] = str(call['agentId'])
        
        logger.info(f"Retrieved {len(calls)} calls with emotion: {emotion_label}")
        
        return jsonify({
            'success': True,
            'count': len(calls),
            'emotion': emotion_label,
            'calls': calls
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching calls by emotion: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch calls by emotion',
            'error': str(error)
        }), 500

def get_calls_by_category(category):
    """Get calls filtered by issue category"""
    try:
        calls = calls_model.find_by_issue_category(category)
        
        for call in calls:
            call['_id'] = str(call['_id'])
            if call.get('customerId'):
                call['customerId'] = str(call['customerId'])
            if call.get('agentId'):
                call['agentId'] = str(call['agentId'])
        
        logger.info(f"Retrieved {len(calls)} calls with category: {category}")
        
        return jsonify({
            'success': True,
            'count': len(calls),
            'category': category,
            'calls': calls
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching calls by category: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch calls by category',
            'error': str(error)
        }), 500

def get_customer_history_by_phone(phone_number):
    """
    Get customer call history by phone number (or customer identifier)
    Used to display previous calls when customer calls again
    """
    try:
        logger.info(f"Fetching call history for phone: {phone_number}")
        
        # Find all recordings for this phone number
        recordings = call_recording_model.collection.find(
            {'from': {'$regex': phone_number}}
        ).sort('createdAt', -1).limit(10)
        
        # Get associated call data
        calls = []
        for recording in recordings:
            call = calls_model.find_one({'recordingSid': recording.get('recordingSid')})
            if call:
                calls.append({
                    '_id': str(call.get('_id')),
                    'recordingSid': call.get('recordingSid'),
                    'transcript': call.get('transcript'),
                    'emotionLabel': call.get('emotionLabel'),
                    'emotionScore': call.get('emotionScore'),
                    'issueCategory': call.get('issueCategory'),
                    'expertiseLevel': call.get('expertiseLevel'),
                    'resolutionStatus': call.get('resolutionStatus'),
                    'summary': call.get('summary'),
                    'bulletPoints': call.get('bulletPoints'),
                    'createdAt': call.get('createdAt').isoformat() if call.get('createdAt') else None
                })
        
        logger.info(f"Found {len(calls)} previous calls for customer")
        
        return jsonify({
            'success': True,
            'count': len(calls),
            'calls': calls
        }), 200
    
    except Exception as error:
        logger.error(f"Error fetching customer history: {error}")
        return jsonify({
            'success': False,
            'message': 'Failed to fetch customer history',
            'error': str(error)
        }), 500