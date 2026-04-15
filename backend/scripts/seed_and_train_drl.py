"""
Seed sample routing experiences into MongoDB and train the DRL router.

This script is intended for demos and local development only. It creates a
small synthetic dataset in the routing_experiences collection, ensures
matching agent profiles exist, and then runs the training loop.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _load_local_env() -> None:
    """Load key/value pairs from backend/.env when available.

    This keeps the script runnable from a plain shell session where the
    backend environment variables have not been exported yet.
    """
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_local_env()

from bson.objectid import ObjectId

from models.agent_profile_model import agent_profile_model
from models.routing_experience_model import routing_experience_model
from utils.drl_routing import drl_router
from utils.routing_state import build_state_vector, compute_reward


SAMPLE_AGENT_PROFILES = [
    {
        "agentId": "66a000000000000000000001",
        "specialization": "Technical",
        "skills": ["technical", "general"],
        "totalCalls": 24,
        "resolvedCalls": 20,
        "avgSatisfactionScore": 0.86,
        "currentLoad": 1,
    },
    {
        "agentId": "66a000000000000000000002",
        "specialization": "Billing",
        "skills": ["billing", "general"],
        "totalCalls": 30,
        "resolvedCalls": 25,
        "avgSatisfactionScore": 0.81,
        "currentLoad": 2,
    },
    {
        "agentId": "66a000000000000000000003",
        "specialization": "General",
        "skills": ["general"],
        "totalCalls": 18,
        "resolvedCalls": 14,
        "avgSatisfactionScore": 0.77,
        "currentLoad": 0,
    },
]


SAMPLE_CUSTOMER_CONTEXTS = [
    {
        "emotion_label": "Frustrated",
        "issue_category": "Technical",
        "expertise_level": "Expert",
        "has_previous_calls": True,
        "previous_resolution_success": False,
    },
    {
        "emotion_label": "Neutral",
        "issue_category": "Billing",
        "expertise_level": "Intermediate",
        "has_previous_calls": True,
        "previous_resolution_success": True,
    },
    {
        "emotion_label": "Satisfied",
        "issue_category": "General",
        "expertise_level": "Beginner",
        "has_previous_calls": False,
        "previous_resolution_success": False,
    },
    {
        "emotion_label": "Negative",
        "issue_category": "Technical",
        "expertise_level": "Intermediate",
        "has_previous_calls": True,
        "previous_resolution_success": False,
    },
    {
        "emotion_label": "Positive",
        "issue_category": "Billing",
        "expertise_level": "Expert",
        "has_previous_calls": True,
        "previous_resolution_success": True,
    },
]


def _sample_call_result(index: int) -> dict:
    return {
        "resolution_status": "Resolved" if index % 3 != 0 else "Escalated",
        "emotion_score": 0.85 if index % 3 != 0 else 0.25,
        "duration": 180 + (index % 5) * 45,
        "avg_resolution_time": 300,
    }


def _seed_agent_profiles() -> None:
    if not agent_profile_model:
        return

    for profile in SAMPLE_AGENT_PROFILES:
        agent_id = ObjectId(profile["agentId"])
        existing = agent_profile_model.collection.find_one({"agentId": agent_id})
        if existing:
            continue

        document = {
            **profile,
            "agentId": agent_id,
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }
        agent_profile_model.collection.insert_one(document)


def _seed_routing_experiences(sample_count: int) -> int:
    if not routing_experience_model:
        raise RuntimeError("routing_experience_model is not initialized")

    existing = routing_experience_model.collection.find_one({"source": "sample_seed"})
    if existing:
        return 0

    inserted = 0
    for index in range(sample_count):
        customer_context = SAMPLE_CUSTOMER_CONTEXTS[index % len(SAMPLE_CUSTOMER_CONTEXTS)]
        agent_profile = SAMPLE_AGENT_PROFILES[index % len(SAMPLE_AGENT_PROFILES)]
        call_result = _sample_call_result(index)

        state = build_state_vector(customer_context, agent_profile, is_last_agent=(index % 4 == 0))
        reward = compute_reward(call_result)

        routing_experience_model.collection.insert_one({
            "state": state,
            "actionIndex": index % len(SAMPLE_AGENT_PROFILES),
            "reward": reward,
            "nextState": state,
            "done": True,
            "priority": abs(reward) + 1e-6,
            "customerId": str(ObjectId()),
            "agentId": agent_profile["agentId"],
            "source": "sample_seed",
            "createdAt": datetime.now(timezone.utc),
        })
        inserted += 1

    return inserted


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed sample DRL data and train the router.")
    parser.add_argument("--sample-count", type=int, default=30, help="Number of sample experiences to insert.")
    parser.add_argument("--batch-size", type=int, default=8, help="Training batch size.")
    parser.add_argument("--n-batches", type=int, default=10, help="Number of training batches.")
    args = parser.parse_args()

    if not os.getenv("MONGO_URI"):
        print("MONGO_URI is not set.")
        return 1

    _seed_agent_profiles()
    inserted = _seed_routing_experiences(args.sample_count)

    if inserted == 0:
        print("Sample dataset already exists. Skipping reseed.")
    else:
        print(f"Inserted {inserted} sample routing experiences.")

    result = drl_router.train(
        routing_experience_model,
        batch_size=args.batch_size,
        n_batches=args.n_batches,
    )

    print("Training result:")
    print(result)
    return 0 if result.get("success") else 2


if __name__ == "__main__":
    raise SystemExit(main())