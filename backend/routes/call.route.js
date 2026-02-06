import express from "express";
import {
    generateToken,
    registerAgent,
    unregisterAgent,
    getAvailableAgent,
    handleVoiceWebhook,
    handleDialStatus,
    handleRecordingCallback,
    getCallStatus,
    getAllRecordings,
    getRecording,
    getUserRecordings,
    getAgentRecordings,
    updateRecordingTicketStatus
} from "../controller/call.controller.js";
import isAuthenticated from "../middleware/isAuthenticated.js";

const router = express.Router();

// Generate token for WebRTC client (agent or user)
router.get("/token/:role", isAuthenticated, generateToken);

// Agent availability
router.post("/register-agent", isAuthenticated, registerAgent);
router.post("/unregister-agent", isAuthenticated, unregisterAgent);
router.get("/available-agent", isAuthenticated, getAvailableAgent);

// Twilio voice webhook - handles incoming calls
router.post("/voice", handleVoiceWebhook);

// Dial status webhook - handles call completion
router.post("/dial-status", handleDialStatus);

// Recording callback - receives recording info after call ends
router.post("/recording", handleRecordingCallback);

// Get call status by SID (optional - for monitoring)
router.get("/status/:callSid", getCallStatus);

// Get all recordings
router.get("/recordings", getAllRecordings);

// Get recordings for a user (role-filtered)
router.get("/recordings/user/:userId", isAuthenticated, getUserRecordings);

// Get recordings for an agent (role-filtered)
router.get("/recordings/agent/:agentId", isAuthenticated, getAgentRecordings);

// Update ticket status on a recording
router.patch("/recordings/:recordingSid/status", isAuthenticated, updateRecordingTicketStatus);

// Get single recording by SID
router.get("/recordings/:recordingSid", getRecording);

export default router;
