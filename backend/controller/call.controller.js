import twilio from "twilio";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { CallRecording } from "../models/callRecording.model.js";
import { User } from "../models/user.model.js";
import { extractIdFromIdentity, enrichRecordingsWithNames } from "../utils/recording.utils.js";

dotenv.config();

const onlineAgents = new Set();

/**
 * Generate Access Token for WebRTC Voice Calls
 * Steps:
 * 1) Validate role and authenticated user.
 * 2) Ensure role matches user role in DB.
 * 3) Build Twilio access token with voice grant.
 * 4) Return token + identity to client.
 */
export const generateToken = async (req, res) => {
    try {
        const { role } = req.params;
        const userId = req.id;

        if (role !== "agent" && role !== "customer") {
            return res.status(400).json({
                success: false,
                message: "Role must be either 'customer' or 'agent'"
            });
        }
        
        const AccessToken = twilio.jwt.AccessToken;
        const VoiceGrant = AccessToken.VoiceGrant;

        const user = await User.findById(userId).select("role");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (role !== user.role) {
            return res.status(403).json({
                success: false,
                message: "Role does not match authenticated user"
            });
        }

        // Generate unique identity based on role + user id
        const identity = `${role}_${userId}`;

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
 * Register agent as available
 * Steps:
 * 1) Verify authenticated user is an agent.
 * 2) Add agent to in-memory availability set.
 * 3) Return agent id.
 */
export const registerAgent = async (req, res) => {
    try {
        const userId = req.id;
        const user = await User.findById(userId).select("role");
        if (!user || user.role !== "agent") {
            return res.status(403).json({
                success: false,
                message: "Only agents can register"
            });
        }

        onlineAgents.add(String(userId));

        return res.status(200).json({
            success: true,
            agentId: String(userId)
        });
    } catch (error) {
        console.error("Error registering agent:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to register agent",
            error: error.message
        });
    }
};

/**
 * Unregister agent
 * Steps:
 * 1) Remove agent from in-memory availability set.
 * 2) Return success.
 */
export const unregisterAgent = async (req, res) => {
    try {
        const userId = req.id;
        onlineAgents.delete(String(userId));

        return res.status(200).json({
            success: true
        });
    } catch (error) {
        console.error("Error unregistering agent:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to unregister agent",
            error: error.message
        });
    }
};

/**
 * Get available agent
 * Steps:
 * 1) Pick first available agent from in-memory set.
 * 2) Return identity for Twilio client dialing.
 */
export const getAvailableAgent = async (req, res) => {
    try {
        const [agentId] = Array.from(onlineAgents);

        if (!agentId) {
            return res.status(404).json({
                success: false,
                message: "No agents are currently online"
            });
        }

        return res.status(200).json({
            success: true,
            agentId,
            identity: `agent_${agentId}`
        });
    } catch (error) {
        console.error("Error fetching available agent:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch available agent",
            error: error.message
        });
    }
};

/**
 * Handle Voice Webhook - Routes incoming calls
 * Steps:
 * 1) Validate the destination identity.
 * 2) Build TwiML with recording and dial options.
 * 3) Dial the agent and return TwiML to Twilio.
 */
export const handleVoiceWebhook = async (req, res) => {
    try {
        const twiml = new twilio.twiml.VoiceResponse();
        const to = req.body.To; // expected: "agent"

        if (!to) {
            twiml.say("No destination specified");
            res.type("text/xml");
            res.send(twiml.toString());
            return;
        }

        // Get the base URL from environment or request
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
        const recordingCallback = `${baseUrl}/api/v1/call/recording`;

        // Create dial with recording options and timeout
        const dial = twiml.dial({
            record: "record-from-answer",
            recordingStatusCallback: recordingCallback,
            timeout: 30, // Wait 30 seconds for agent to answer
            action: `${baseUrl}/api/v1/call/dial-status` // Handle dial completion
        });

        // Dial the client (agent)
        dial.client(to);

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
 * Steps:
 * 1) Read Twilio dial outcome and call metadata.
 * 2) Save recording + identities when completed.
 * 3) Speak a relevant message and return TwiML.
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

        // Handle different dial outcomes
        if (dialCallStatus === 'completed') {
            // Call was answered and completed normally
            twiml.say("Thank you for calling. Goodbye.");
            
            // Save recording info if available
            if (RecordingSid && RecordingUrl) {
                try {
                    const userId = extractIdFromIdentity(From, ["customer", "user"]);
                    const agentId = extractIdFromIdentity(To, "agent");

                    await CallRecording.create({
                        recordingSid: RecordingSid,
                        recordingUrl: RecordingUrl,
                        duration: RecordingDuration,
                        callSid: CallSid,
                        from: From,
                        to: To,
                        userId,
                        agentId,
                        status: 'completed'
                    });
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
 * Steps:
 * 1) Log recording metadata for traceability.
 * 2) Return success (DB save happens in dial-status).
 */
export const handleRecordingCallback = async (req, res) => {
    try {
        const {
            RecordingUrl,
            RecordingSid,
            RecordingDuration,
            CallSid
        } = req.body;

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
 * Steps:
 * 1) Fetch call details from Twilio.
 * 2) Return a compact status payload.
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
 * Steps:
 * 1) Fetch latest recordings.
 * 2) Return list and count.
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
 * Steps:
 * 1) Lookup by recordingSid.
 * 2) Return record or 404.
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

/**
 * Get Recordings for a User
 * Steps:
 * 1) Verify requester matches userId.
 * 2) Query by stored userId or fallback identity.
 * 3) Backfill missing ids and populate names.
 * 4) Return list and count.
 */
export const getUserRecordings = async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.id;

        if (String(userId) !== String(requesterId)) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const identityPatterns = [
            new RegExp(`customer_${userId}$`),
            new RegExp(`user_${userId}$`)
        ];

        const recordings = await CallRecording.find({
            $or: [
                { userId },
                { from: { $in: identityPatterns } }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(100);

        const enrichedRecordings = await enrichRecordingsWithNames(recordings);

        return res.status(200).json({
            success: true,
            count: enrichedRecordings.length,
            recordings: enrichedRecordings
        });
    } catch (error) {
        console.error("Error fetching user recordings:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user recordings",
            error: error.message
        });
    }
};

/**
 * Get Recordings for an Agent
 * Steps:
 * 1) Verify requester matches agentId.
 * 2) Query by stored agentId or fallback identity.
 * 3) Backfill missing ids and populate names.
 * 4) Return list and count.
 */
export const getAgentRecordings = async (req, res) => {
    try {
        const { agentId } = req.params;
        const requesterId = req.id;

        if (String(agentId) !== String(requesterId)) {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const identityPatterns = [
            new RegExp(`agent_${agentId}$`)
        ];

        const recordings = await CallRecording.find({
            $or: [
                { agentId },
                { to: { $in: identityPatterns } }
            ]
        })
            .sort({ createdAt: -1 })
            .limit(100);

        const enrichedRecordings = await enrichRecordingsWithNames(recordings);

        return res.status(200).json({
            success: true,
            count: enrichedRecordings.length,
            recordings: enrichedRecordings
        });
    } catch (error) {
        console.error("Error fetching agent recordings:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch agent recordings",
            error: error.message
        });
    }
};

/**
 * Update Ticket Status on a Recording
 * Steps:
 * 1) Validate requested ticket status.
 * 2) Load recording by recordingSid.
 * 3) Ensure requester is assigned agent.
 * 4) Persist ticketStatus and return updated record.
 */
export const updateRecordingTicketStatus = async (req, res) => {
    try {
        const { recordingSid } = req.params;
        const { ticketStatus } = req.body;
        const requesterId = req.id;

        const allowedStatuses = ["Pending", "Resolved", "Closed"];
        if (!allowedStatuses.includes(ticketStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ticket status"
            });
        }

        const recording = await CallRecording.findOne({ recordingSid });
        if (!recording) {
            return res.status(404).json({
                success: false,
                message: "Recording not found"
            });
        }

        const requesterIdentityPattern = new RegExp(`agent_${requesterId}$`);
        const isAssignedAgent = recording.agentId
            ? String(recording.agentId) === String(requesterId)
            : requesterIdentityPattern.test(recording.to || "");

        if (!isAssignedAgent) {
            return res.status(403).json({
                success: false,
                message: "Only the assigned agent can update status"
            });
        }

        recording.ticketStatus = ticketStatus;
        await recording.save();

        return res.status(200).json({
            success: true,
            recording
        });
    } catch (error) {
        console.error("Error updating ticket status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update ticket status",
            error: error.message
        });
    }
};
