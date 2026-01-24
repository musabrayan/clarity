import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const register = async (req, res) => {
    try {
        const { fullName, username, email, password, phoneNumber, role } = req.body;
        
        if (!fullName || !username || !email || !password || !phoneNumber || !role) {
            return res.status(400).json({
                message: "All fields are required",
                success: false
            });
        }

        // Validate role
        if (role !== 'customer' && role !== 'agent') {
            return res.status(400).json({
                message: "Role must be either 'customer' or 'agent'",
                success: false
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({
                message: "User already exists with this email or username",
                success: false
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        await User.create({
            fullName,
            username,
            email,
            password: hashedPassword,
            phoneNumber,
            role
        });

        return res.status(201).json({
            message: "Account created successfully",
            success: true
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Server error",
            success: false
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if ((!email && !username) || !password) {
            return res.status(400).json({
                message: "Username/email and password are required",
                success: false
            });
        }

        // Find user by email or username
        let user = await User.findOne({ $or: [{ email }, { username }] });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect username/email or password",
                success: false
            });
        }

        // Check if password matches
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect username/email or password",
                success: false
            });
        }

        // Generate JWT token
        const tokenData = {
            userId: user._id
        };
        const token = jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        // Send response with cookie
        user = {
            _id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role
        };

        return res.status(200).cookie("token", token, { 
            maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day
            httpOnly: true, 
            sameSite: 'strict' 
        }).json({
            message: `Welcome back ${user.fullName}`,
            user,
            success: true
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Server error",
            success: false
        });
    }
};

export const logout = async (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "Logged out successfully",
            success: true
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Server error",
            success: false
        });
    }
};
