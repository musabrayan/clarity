import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./utils/db.js";
import userRoute from "./routes/user.route.js";
import callRoute from "./routes/call.route.js";
import path from "path";

dotenv.config();

const app = express();

const _dirname = path.resolve();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const corsOptions = {
    origin: ['http://localhost:5173','https://clarity-ghas.onrender.com'],
    credentials: true
};
app.use(cors(corsOptions));

const PORT = process.env.PORT || 3000;

// API routes
app.use("/api/v1/user", userRoute);
app.use("/api/v1/call", callRoute);


app.use(express.static(path.join(_dirname, "/frontend/dist")))
app.get(/.*/, (req, res) => {
    res.sendFile(path.resolve(_dirname, "frontend", "dist", "index.html"));
});

// Start server immediately
app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
    // Connect to database in background (non-blocking)
    connectDB().catch(err => {
        console.error("Database connection failed:", err.message);
    });
});
