import express from "express";
import {
    generateToken,
    handleVoiceWebhook,
    handleDialStatus,
    handleRecordingCallback,
    getCallStatus,
    getAllRecordings,
    getRecording
} from "../controller/call.controller.js";

const router = express.Router();

// Generate token for WebRTC client (agent or user)
router.get("/token/:role", generateToken);

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

// Get single recording by SID
router.get("/recordings/:recordingSid", getRecording);

export default router;
