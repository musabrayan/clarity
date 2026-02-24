import os
import requests
import json
import logging
from datetime import datetime
import base64
import time
from groq import Groq
from pathlib import Path

logger = logging.getLogger(__name__)

class AIProcessor:
    def __init__(self):
        self.groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        
        # Setup storage paths
        self.recordings_path = Path(os.getenv('RECORDINGS_PATH', 'recordings'))
        self.models_path = Path(os.getenv('MODELS_PATH', 'models'))
        
        # Create directories if they don't exist
        self.recordings_path.mkdir(parents=True, exist_ok=True)
        self.models_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"AIProcessor initialized")
        logger.info(f"Recordings path: {self.recordings_path}")
        logger.info(f"Models path: {self.models_path}")
    
    def transcribe_audio(self, audio_file_path):
        """
        Transcribe audio using Groq's Whisper API
        Supports MP3, MP4, MPEG, MPGA, M4A, WAV, and WEBM formats
        """
        try:
            logger.info(f"Starting transcription for: {audio_file_path}")
            
            # Convert to absolute path
            audio_path = Path(audio_file_path).resolve()
            
            logger.info(f"Absolute path: {audio_path}")
            logger.info(f"Path exists: {audio_path.exists()}")
            
            if not audio_path.exists():
                logger.error(f"Audio file not found: {audio_file_path}")
                logger.error(f"Resolved path: {audio_path}")
                return {
                    'success': False,
                    'error': 'Audio file not found'
                }
            
            file_size_mb = audio_path.stat().st_size / (1024 * 1024)
            logger.info(f"File size: {file_size_mb:.2f} MB")
            
            if file_size_mb > 25:
                logger.error(f"File too large: {file_size_mb}MB (max 25MB)")
                return {
                    'success': False,
                    'error': 'Audio file too large (max 25MB)'
                }
            
            # Transcribe using Groq Whisper API
            logger.info("Sending to Groq Whisper API")
            
            with open(audio_path, "rb") as audio_file:
                transcription = self.groq_client.audio.transcriptions.create(
                    file=audio_file,
                    model="whisper-large-v3"
                )
            
            transcript = transcription.text
            
            logger.info("Transcription completed successfully")
            logger.info(f"Transcript length: {len(transcript)} characters")
            
            return {
                'success': True,
                'transcript': transcript
            }
        
        except FileNotFoundError as e:
            logger.error(f"File not found error: {audio_file_path}")
            return {
                'success': False,
                'error': 'Audio file not found'
            }
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    def analyze_transcript(self, transcript, previous_summary=None):
        """
        Analyze transcript using Groq (free, very fast)
        """
        try:
            logger.info("Starting transcript analysis with Groq...")
            
            system_prompt = """You are an AI assistant analyzing customer support call transcripts.
            
            Analyze the provided transcript and extract:
            1. Emotion Label: One of [Positive, Neutral, Negative, Frustrated, Satisfied]
            2. Emotion Score: 0-1 (0=very negative, 1=very positive)
            3. Issue Category: One of [Sales, Technical, Billing, General, Other]
            4. Expertise Level: One of [Beginner, Intermediate, Expert]
            5. Resolution Status: One of [Resolved, Pending, Escalated, Follow-up Required]
            6. Short Summary: 2-3 sentences
            7. Bullet Points: 3-5 key points from the call
            
            Return ONLY valid JSON, no markdown, no extra text."""
            
            user_message = f"""Analyze this customer support call transcript:

{transcript}
"""
            
            if previous_summary:
                user_message += f"\n\nPrevious Call Summary for context:\n{previous_summary}"
            
            user_message += """\n\nRespond with ONLY this exact JSON structure:
{
    "emotion_label": "string",
    "emotion_score": 0.0,
    "issue_category": "string",
    "expertise_level": "string",
    "resolution_status": "string",
    "summary": "string",
    "bullet_points": ["point1", "point2", "point3"]
}"""
            
            # Use Groq for fast LLM inference
            response = self.groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",  # Free and very fast
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,
                max_tokens=1000,
              
            )

            response_text = response.choices[0].message.content.strip()
            logger.info(f"Groq response received, length: {len(response_text)}")
            
            try:
                analysis = json.loads(response_text)
            except json.JSONDecodeError:
                import re
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    analysis = json.loads(json_match.group())
                else:
                    logger.error(f"Could not extract JSON from response: {response_text}")
                    raise ValueError("Could not parse JSON from response")
            
            logger.info("Transcript analysis completed successfully")
            logger.info(f"Analysis result: Emotion={analysis.get('emotion_label')}, Category={analysis.get('issue_category')}")
            
            return {
                'success': True,
                'analysis': analysis
            }
        
        except Exception as e:
            logger.error(f"Error analyzing transcript: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'analysis': None
            }
    
    def download_recording(self, recording_url, session_id, max_retries=5):
        """
        Download recording from Twilio URL with authentication
        Saves as MP3 format
        Implements retry logic with exponential backoff
        Uses buffered I/O for performance optimization
        """
        try:
            logger.info(f"Downloading recording from: {recording_url}")
            
            # Create Basic Auth header for Twilio API
            auth_string = f"{self.twilio_account_sid}:{self.twilio_auth_token}"
            auth_bytes = auth_string.encode('utf-8')
            auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
            
            headers = {
                'Authorization': f'Basic {auth_b64}'
            }
            
            recording_url_mp3 = recording_url + ".mp3"
            
            # Retry logic with exponential backoff
            for attempt in range(max_retries):
                try:
                    logger.info(f"Attempt {attempt + 1}/{max_retries}: Requesting recording...")
                    
                    response = requests.get(recording_url_mp3, headers=headers, timeout=60, stream=True)
                    response.raise_for_status()
                    
                    # Use buffered I/O for efficient file writing
                    file_path = self.recordings_path / f"recording_{session_id}.mp3"
                    
                    # Write with buffer size optimization
                    with open(file_path, 'wb', buffering=1024*64) as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    
                    logger.info(f"Recording downloaded successfully, size: {file_path.stat().st_size} bytes")
                    logger.info(f"Recording saved to: {file_path}")
                    
                    # Return absolute path as string
                    return True, str(file_path.resolve())
                
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 404:
                        if attempt < max_retries - 1:
                            wait_time = 2 ** attempt
                            logger.warning(f"Recording not ready (404). Retrying in {wait_time}s...")
                            time.sleep(wait_time)
                            continue
                        else:
                            logger.error(f"Recording not ready after {max_retries} attempts")
                            return False, None
                    else:
                        logger.error(f"HTTP Error: {e.response.status_code}")
                        return False, None
                
                except Exception as e:
                    logger.error(f"Error on attempt {attempt + 1}: {str(e)}")
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt
                        logger.warning(f"Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    else:
                        return False, None
        
        except Exception as e:
            logger.error(f"Error downloading recording: {str(e)}", exc_info=True)
            return False, None
    
    def cleanup_old_recordings(self, days=7):
        """
        Clean up recording files older than specified days
        Helps manage disk space on Render
        """
        try:
            logger.info(f"Cleaning up recordings older than {days} days...")
            
            import time as time_module
            current_time = time_module.time()
            deleted_count = 0
            freed_space = 0
            
            for file_path in self.recordings_path.glob("recording_*.mp3"):
                file_age_days = (current_time - file_path.stat().st_mtime) / (24 * 3600)
                
                if file_age_days > days:
                    file_size = file_path.stat().st_size
                    file_path.unlink()
                    deleted_count += 1
                    freed_space += file_size
                    logger.info(f"Deleted old recording: {file_path.name}")
            
            if deleted_count > 0:
                freed_space_mb = freed_space / (1024 * 1024)
                logger.info(f"Cleaned up {deleted_count} old recordings, freed {freed_space_mb:.2f} MB")
        
        except Exception as e:
            logger.error(f"Error cleaning up recordings: {str(e)}")
    
    def process_full_pipeline(self, recording_url, session_id, previous_summary=None):
        """
        Complete pipeline: Download (with retries) → Transcribe (Groq Whisper) → Analyze (Groq LLM)
        """
        try:
            logger.info(f"Starting full processing pipeline for session: {session_id}")
            
            # Clean up old recordings periodically
            self.cleanup_old_recordings(days=3)  # Keep for 3 days
            
            # Step 1: Download recording with retry logic
            success, file_path = self.download_recording(recording_url, session_id)
            if not success:
                logger.error("Failed to download recording after retries")
                return {
                    'success': False,
                    'error': 'Failed to download recording'
                }
            
            # Verify file exists
            file_path_obj = Path(file_path).resolve()
            if not file_path_obj.exists():
                logger.error(f"Downloaded file does not exist: {file_path}")
                return {
                    'success': False,
                    'error': 'Downloaded file missing'
                }
            
            logger.info(f"File verified: {file_path_obj}, size: {file_path_obj.stat().st_size} bytes")
            
            # Step 2: Transcribe with Groq Whisper API
            transcribe_result = self.transcribe_audio(str(file_path_obj))
            if not transcribe_result['success']:
                logger.error(f"Transcription failed: {transcribe_result.get('error')}")
                return {
                    'success': False,
                    'error': f"Transcription failed: {transcribe_result.get('error')}"
                }
            
            transcript = transcribe_result['transcript']
            logger.info(f"Transcript obtained, length: {len(transcript)} characters")
            
            # Step 3: Analyze with Groq LLM
            analyze_result = self.analyze_transcript(transcript, previous_summary)
            if not analyze_result['success']:
                logger.error(f"Analysis failed: {analyze_result.get('error')}")
                return {
                    'success': False,
                    'error': f"Analysis failed: {analyze_result.get('error')}"
                }
            
            # Step 4: Cleanup recording file after processing
            try:
                file_path_obj.unlink()
                logger.info("Temporary recording file deleted")
            except Exception as e:
                logger.warning(f"Could not delete temp file: {e}")
            
            # Combine results
            result = {
                'success': True,
                'transcript': transcript,
                'emotion_label': analyze_result['analysis'].get('emotion_label'),
                'emotion_score': analyze_result['analysis'].get('emotion_score'),
                'issue_category': analyze_result['analysis'].get('issue_category'),
                'expertise_level': analyze_result['analysis'].get('expertise_level'),
                'resolution_status': analyze_result['analysis'].get('resolution_status'),
                'summary': analyze_result['analysis'].get('summary'),
                'bullet_points': analyze_result['analysis'].get('bullet_points')
            }
            
            logger.info(f"Pipeline completed successfully for session: {session_id}")
            logger.info(f"Final Analysis: Emotion={result['emotion_label']} ({result['emotion_score']}), Category={result['issue_category']}")
            
            return result
        
        except Exception as e:
            logger.error(f"Pipeline error: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

# Initialize processor
ai_processor = AIProcessor()