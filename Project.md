AI-Powered Intelligent Call Routing and Context-Aware Customer Support System Using WebRTC and DRL

System Objective

Build a browser-based contact center system where:

Customers make calls using WebRTC

Agents receive calls via WebRTC

Calls are recorded automatically

AI performs:

Speech-to-Text

Emotion Analysis

Issue Classification

Expertise Detection

Context-Aware Summarization

Calls are routed using Skill-Based + DRL-based intelligent routing

All without traditional telecom (no ISD, no physical phone dependency).

Final Architecture (WebRTC Only)
Customer Browser (WebRTC)
        ↓
Twilio Voice SDK
        ↓
Twilio Cloud
        ↓
Flask Backend (/voice webhook)
        ↓
Routing Engine (Rule-based → DRL later)
        ↓
Agent Browser (WebRTC)
        ↓
Call Recording
        ↓
Recording Callback → Flask
        ↓
OpenAI APIs (STT + Analysis)
        ↓
MongoDb Database

Technology Stack
Frontend

ReactJS (Customer + Agent Dashboard)

Twilio Voice JS SDK (WebRTC)

Backend

Python Flask

Twilio Webhooks

Mongodb (database)

OpenAI API (cloud AI)

AI Services

STT → OpenAI transcription API

Emotion + Issue Classification → LLM

Context-aware summary → LLM

Later → DRL (DQN)

Development Phases (Correct Order)
Phase 1 — Twilio WebRTC Setup

Create Twilio Account

Create TwiML App

Voice URL → https://your-ngrok-link/voice

Create API Key + Secret

Create Flask /token endpoint

Generates Twilio Access Token

Build simple WebRTC client

Fetch token

Initialize Twilio.Device

device.connect() to initiate call

Confirm:

Call hits Flask /voice

TwiML response works

Goal:
WebRTC call working end-to-end(Done)

Phase 2 — Call Recording Integration

Inside /voice webhook:

Play IVR message

Route call (temporary simple logic)

Enable recording

After call ends:

Twilio sends:

Recording URL

Caller identity

Flask:

Downloads recording

Stores basic metadata

Goal:
System receives and stores recordings

Phase 3 — AI Processing Pipeline (API-Based Only)

When recording callback fires:

Download audio file

Send to OpenAI transcription API

Get transcript

Send transcript to LLM with structured JSON prompt:

Required JSON:

{
  "emotion_label": "",
  "emotion_score": 0-1,
  "issue_category": "Sales/Technical/Billing/General",
  "expertise_level": "Beginner/Intermediate/Expert",
  "resolution_status": "",
  "short_summary": ""
}

Store structured output in SQLite

Goal:
AI-based contextual memory system working

Phase 4 — Context-Aware Memory

When same customer calls again:

Fetch previous summary from DB

Pass previous summary into new LLM prompt

Generate updated context-aware analysis

Display in Agent dashboard

Goal:
Customers don’t need to re-explain issues

Phase 5 — Skill-Based Routing (Before DRL)

Create:

Agent Table

id

name

availability

skill vector (Sales, Technical, Billing, Software, Hardware)

Routing logic:

If returning customer:
Try previous agent
Else:
Match issue_category to agent skill
Select highest skill match among available agents

Goal:
Intelligent rule-based routing working

Phase 6 — DRL-Based Routing (Research Layer)

Formalize routing as MDP:

State:

Emotion score

Issue category

Expertise level

Agent availability

Agent skill match

Agent workload

Action:

Assign Agent_i

Reward:

+10 resolved

-10 escalated

-5 repeat call

-15 sentiment drop

+5 quick resolution

Algorithm:

Deep Q Network (DQN)

Training:

Simulated environment (not live calls)

Deployment:

Use trained model for routing decisions

Goal:
AI-learned optimal routing policy

Why WebRTC Is Used

Avoid ISD costs

No telecom restrictions

Fully browser-based

Simulates real cloud contact center

Scalable architecture

Database Design 
customers

id

identity

first_seen

calls

id

customer_id

transcript

emotion_label

emotion_score

issue_category

expertise_level

summary

created_at

agents

id

name

availability

skill_vector

performance_metrics

Security Considerations

Twilio Access Token generated server-side

No secrets in frontend

HTTPS via ngrok (dev)

Validate Twilio webhook signatures (production)

Final System Capabilities

WebRTC-based customer calling

Multi-agent browser-based receiving

AI-powered call understanding

Emotion detection

Context memory

Skill-based routing

DRL-enhanced optimization

Fully scalable backend architecture

Academic Strength

This project demonstrates:

Real-time communication systems

Distributed architecture

NLP & Speech Processing

Reinforcement Learning

Telephony engineering

Context-aware AI systems

Production-grade system design