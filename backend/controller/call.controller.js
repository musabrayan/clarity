import twilio from "twilio";
import dotenv from "dotenv";
import { CallRecording } from "../models/callRecording.model.js";

dotenv.config();

/**
 * Generate Access Token for WebRTC Voice Calls
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const generateToken = async (req, res) => {
    try {
        const { role } = req.params;
        
        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        // Generate unique identity based on role
        const identity = role === "agent" 
            ? "agent" 
            : `user_${Date.now()}`;

        // Create access token
        const token = new AccessToken(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_API_KEY,
            process.env.TWILIO_API_SECRET,
            { identity }
        );

        // Add voice grant
        token.addGrant(
            new VoiceGrant({
                outgoingApplicationSid: process.env.TWIML_APP_SID,
                incomingAllow: true
            })
        );

        return res.status(200).json({
            success: true,
            token: token.toJwt(),
            identity
        });
    } catch (error) {
        console.error("Error generating token:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate token",
            error: error.message
        });
    }
};

/**
 * Handle Voice Webhook - Routes incoming calls
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleVoiceWebhook = async (req, res) => {
    try {
        const twiml = new twilio.twiml.VoiceResponse();
        const to = req.body.To; // expected: "agent"

        console.log("Voice webhook - Full request body:", req.body);
        console.log("Incoming call - Dialing:", to);

        if (!to) {
            console.error("No 'To' parameter provided");
            twiml.say("No destination specified");
            res.type("text/xml");
            res.send(twiml.toString());
            return;
        }

        // Get the base URL from environment or request
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const recordingCallback = `${baseUrl}/api/v1/call/recording`;

        console.log("Recording callback URL:", recordingCallback);

        // Create dial with recording options and timeout
        const dial = twiml.dial({
            record: "record-from-answer",
            recordingStatusCallback: recordingCallback,
            timeout: 30, // Wait 30 seconds for agent to answer
            action: `${baseUrl}/api/v1/call/dial-status` // Handle dial completion
        });

        // Dial the client (agent)
        dial.client(to);

        console.log("Generated TwiML:", twiml.toString());

        res.type("text/xml");
        res.send(twiml.toString());
    } catch (error) {
        console.error("Error handling voice webhook:", error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say("An error occurred. Please try again later.");
        res.type("text/xml");
        res.send(twiml.toString());
    }
};

/**
 * Handle Dial Status - What happens after dial attempt
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleDialStatus = async (req, res) => {
    try {
        const twiml = new twilio.twiml.VoiceResponse();
        const dialCallStatus = req.body.DialCallStatus;
        const {
            RecordingUrl,
            RecordingSid,
            RecordingDuration,
            CallSid,
            From,
            To
        } = req.body;

        console.log("Dial Status Webhook:", req.body);
        console.log("DialCallStatus:", dialCallStatus);

        // Handle different dial outcomes
        if (dialCallStatus === 'completed') {
            // Call was answered and completed normally
            twiml.say("Thank you for calling. Goodbye.");
            
            // Save recording info if available
            if (RecordingSid && RecordingUrl) {
                try {
                    await CallRecording.create({
                        recordingSid: RecordingSid,
                        recordingUrl: RecordingUrl,
                        duration: RecordingDuration,
                        callSid: CallSid,
                        from: From,
                        to: To,
                        status: 'completed'
                    });
                    console.log("Recording saved to database from dial status");
                } catch (dbError) {
                    console.error("Failed to save recording to database:", dbError);
                }
            }
        } else if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy') {
            // Agent didn't answer or was busy
            twiml.say("Sorry, all agents are currently unavailable. Please try again later.");
        } else if (dialCallStatus === 'failed' || dialCallStatus === 'canceled') {
            // Call failed for some reason
            twiml.say("We're sorry, but we're experiencing technical difficulties. Please try again later.");
        } else {
            // Unknown status
            twiml.say("Thank you for calling. Goodbye.");
        }

        res.type("text/xml");
        res.send(twiml.toString());
    } catch (error) {
        console.error("Error handling dial status:", error);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say("Goodbye.");
        res.type("text/xml");
        res.send(twiml.toString());
    }
};

/**
 * Handle Recording Callback - Log recording information
 * Note: Recording is saved in handleDialStatus webhook which has all required fields
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleRecordingCallback = async (req, res) => {
    try {
        const {
            RecordingUrl,
            RecordingSid,
            RecordingDuration,
            CallSid
        } = req.body;

        console.log("Recording callback received:", {
            recordingSid: RecordingSid,
            url: RecordingUrl,
            duration: RecordingDuration,
            callSid: CallSid
        });

        // Note: Recording is saved from dial-status webhook which includes From/To fields
        // This callback is kept for logging and potential future use

        return res.status(200).json({
            success: true,
            message: "Recording info received"
        });
    } catch (error) {
        console.error("Error handling recording callback:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process recording",
            error: error.message
        });
    }
};

/**
 * Get Call Status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCallStatus = async (req, res) => {
    try {
        const { callSid } = req.params;

        const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
        );

        const call = await client.calls(callSid).fetch();

        return res.status(200).json({
            success: true,
            call: {
                sid: call.sid,
                status: call.status,
                duration: call.duration,
                from: call.from,
                to: call.to,
                startTime: call.startTime,
                endTime: call.endTime
            }
        });
    } catch (error) {
        console.error("Error fetching call status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch call status",
            error: error.message
        });
    }
};

/**
 * Get All Call Recordings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllRecordings = async (req, res) => {
    try {
        const recordings = await CallRecording.find()
            .sort({ createdAt: -1 })
            .limit(50);

        return res.status(200).json({
            success: true,
            count: recordings.length,
            recordings
        });
    } catch (error) {
        console.error("Error fetching recordings:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recordings",
            error: error.message
        });
    }
};

/**
 * Get Single Recording
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getRecording = async (req, res) => {
    try {
        const { recordingSid } = req.params;

        const recording = await CallRecording.findOne({ recordingSid });

        if (!recording) {
            return res.status(404).json({
                success: false,
                message: "Recording not found"
            });
        }

        return res.status(200).json({
            success: true,
            recording
        });
    } catch (error) {
        console.error("Error fetching recording:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recording",
            error: error.message
        });
    }
};
