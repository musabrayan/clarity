import mongoose from "mongoose";
import { User } from "../models/user.model.js";

/**
 * Extract MongoDB ObjectId from Identity String
 * Parses identity format: "role_objectId" -> objectId
 */
export const extractIdFromIdentity = (value, expectedPrefixes) => {
    if (!value) return null;
    
    // Remove "client:" prefix if present
    const identity = value.startsWith("client:") 
        ? value.slice("client:".length) 
        : value;
    
    const prefixes = Array.isArray(expectedPrefixes)
        ? expectedPrefixes
        : [expectedPrefixes];

    for (const expectedPrefix of prefixes) {
        const prefix = `${expectedPrefix}_`;
        if (identity.startsWith(prefix)) {
            const id = identity.slice(prefix.length);
            return mongoose.Types.ObjectId.isValid(id) ? id : null;
        }
    }

    return null;
};

/**
 * Enrich Recordings with User/Agent Names (Read-Only)
 * Computes names on-the-fly without modifying database
 */
export const enrichRecordingsWithNames = async (recordings) => {
    // Collect all unique user IDs and agent IDs
    const userIds = new Set();
    const agentIds = new Set();

    for (const recording of recordings) {
        // Get from existing field or extract from identity
        const userId = recording.userId || extractIdFromIdentity(recording.from, ["customer", "user"]);
        const agentId = recording.agentId || extractIdFromIdentity(recording.to, "agent");
        
        if (userId) userIds.add(String(userId));
        if (agentId) agentIds.add(String(agentId));
    }

    // Fetch all users in one query
    const allUserIds = [...userIds, ...agentIds];
    const users = await User.find({ _id: { $in: allUserIds } })
        .select("fullName username email")
        .lean();

    // Create lookup map
    const userMap = new Map();
    users.forEach(user => {
        userMap.set(String(user._id), user);
    });

    // Enrich recordings with computed fields
    return recordings.map(recording => {
        const recordingObj = recording.toObject ? recording.toObject() : recording;
        
        const userId = recordingObj.userId || extractIdFromIdentity(recordingObj.from, ["customer", "user"]);
        const agentId = recordingObj.agentId || extractIdFromIdentity(recordingObj.to, "agent");
        
        return {
            ...recordingObj,
            customerName: userId ? userMap.get(String(userId))?.fullName || "Unknown" : "Unknown",
            customerEmail: userId ? userMap.get(String(userId))?.email || "" : "",
            agentName: agentId ? userMap.get(String(agentId))?.fullName || "Unknown" : "Unknown",
            agentEmail: agentId ? userMap.get(String(agentId))?.email || "" : ""
        };
    });
};
