import mongoose from "mongoose";

const callRecordingSchema = new mongoose.Schema({
    recordingSid: {
        type: String,
        required: true,
        unique: true
    },
    callSid: {
        type: String,
        required: true
    },
    recordingUrl: {
        type: String,
        required: true
    },
    duration: {
        type: Number, // Duration in seconds
        required: true
    },
    from: {
        type: String,
        required: true
    },
    to: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['completed', 'failed', 'processing'],
        default: 'completed'
    },
    ticketStatus: {
        type: String,
        enum: ['Pending', 'Resolved', 'Closed'],
        default: 'Pending'
    },
    // Optional: Link to user if you want to track which user made the call
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Optional: Link to agent if you want to track which agent handled it
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

export const CallRecording = mongoose.model("CallRecording", callRecordingSchema);
