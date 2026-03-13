"""
Unit tests for the DRL call routing system.

Tests routing_state feature extraction, reward computation,
and DRL agent selection logic (without MongoDB).
"""

import sys
import os

# Add backend to path so we can import utils.routing_state directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.routing_state import (
    encode_emotion, encode_category, encode_expertise, encode_specialization,
    compute_skill_match, build_state_vector, build_customer_context_from_last_call,
    compute_reward,
    STATE_DIM, NUM_CATEGORICAL, NUM_CONTINUOUS,
    EMOTION_MAP, CATEGORY_MAP, EXPERTISE_MAP,
)


# ═══════════════════════════════════════════════════════════════════════════
# Test: Feature Encoding
# ═══════════════════════════════════════════════════════════════════════════

def test_emotion_encoding():
    assert encode_emotion('Positive') == 0
    assert encode_emotion('Neutral') == 1
    assert encode_emotion('Negative') == 2
    assert encode_emotion('Frustrated') == 3
    assert encode_emotion('Satisfied') == 4
    # Unknown falls back to Neutral
    assert encode_emotion('Unknown') == 1
    assert encode_emotion(None) == 1
    print("  ✓ emotion encoding")


def test_category_encoding():
    assert encode_category('Sales') == 0
    assert encode_category('Technical') == 1
    assert encode_category('Billing') == 2
    assert encode_category('General') == 3
    assert encode_category('Other') == 4
    # Unknown falls back to Other
    assert encode_category('xyz') == 4
    print("  ✓ category encoding")


def test_expertise_encoding():
    assert encode_expertise('Beginner') == 0
    assert encode_expertise('Intermediate') == 1
    assert encode_expertise('Expert') == 2
    assert encode_expertise('unknown') == 0
    print("  ✓ expertise encoding")


def test_specialization_encoding():
    # Specialization uses the same map as category
    assert encode_specialization('Technical') == 1
    assert encode_specialization('General') == 3
    print("  ✓ specialization encoding")


# ═══════════════════════════════════════════════════════════════════════════
# Test: Skill Match
# ═══════════════════════════════════════════════════════════════════════════

def test_skill_match():
    assert compute_skill_match(['technical', 'billing'], 'Technical') == 1.0
    assert compute_skill_match(['general'], 'Billing') == 0.5
    assert compute_skill_match(['sales'], 'Technical') == 0.0
    assert compute_skill_match([], 'Technical') == 0.0
    assert compute_skill_match(None, 'Technical') == 0.0
    assert compute_skill_match(['billing'], None) == 0.0
    print("  ✓ skill match")


# ═══════════════════════════════════════════════════════════════════════════
# Test: State Vector
# ═══════════════════════════════════════════════════════════════════════════

def test_state_vector_dimensions():
    assert STATE_DIM == 11, f"Expected 11, got {STATE_DIM}"
    assert NUM_CATEGORICAL == 4
    assert NUM_CONTINUOUS == 7
    print("  ✓ state vector dimensions")


def test_build_state_vector():
    customer = {
        'emotion_label': 'Frustrated',
        'issue_category': 'Technical',
        'expertise_level': 'Expert',
        'has_previous_calls': True,
        'previous_resolution_success': False,
    }
    agent = {
        'specialization': 'Technical',
        'skills': ['technical', 'general'],
        'totalCalls': 100,
        'resolvedCalls': 80,
        'avgSatisfactionScore': 0.75,
        'currentLoad': 2,
    }

    sv = build_state_vector(customer, agent, is_last_agent=True)
    assert len(sv) == STATE_DIM, f"Expected {STATE_DIM}, got {len(sv)}"

    # Check categorical indices
    assert sv[0] == EMOTION_MAP['Frustrated']       # 3
    assert sv[1] == CATEGORY_MAP['Technical']        # 1
    assert sv[2] == EXPERTISE_MAP['Expert']          # 2
    assert sv[3] == CATEGORY_MAP['Technical']        # 1 (specialization)

    # Check continuous features
    assert sv[4] == 1   # has_previous_calls
    assert sv[5] == 0   # previous_resolution_success = False
    assert sv[6] == 1.0 # skill match (technical in agent skills)
    assert abs(sv[7] - 0.8) < 0.01   # resolution rate 80/100
    assert abs(sv[8] - 0.75) < 0.01  # avg satisfaction
    assert abs(sv[9] - 0.2) < 0.01   # load normalized (2/10)
    assert sv[10] == 1  # is_last_agent
    print("  ✓ build state vector")


def test_build_state_vector_missing_data():
    """Test with minimal/missing data — should not crash."""
    customer = {}
    agent = {}
    sv = build_state_vector(customer, agent)
    assert len(sv) == STATE_DIM
    print("  ✓ state vector with missing data")


# ═══════════════════════════════════════════════════════════════════════════
# Test: Customer Context from Last Call
# ═══════════════════════════════════════════════════════════════════════════

def test_customer_context_from_last_call():
    last_call = {
        'emotionLabel': 'Satisfied',
        'issueCategory': 'Billing',
        'expertiseLevel': 'Intermediate',
        'resolutionStatus': 'Resolved',
    }
    ctx = build_customer_context_from_last_call(last_call)
    assert ctx['emotion_label'] == 'Satisfied'
    assert ctx['issue_category'] == 'Billing'
    assert ctx['expertise_level'] == 'Intermediate'
    assert ctx['has_previous_calls'] is True
    assert ctx['previous_resolution_success'] is True
    print("  ✓ customer context from last call")


def test_customer_context_from_none():
    ctx = build_customer_context_from_last_call(None)
    assert ctx['emotion_label'] == 'Neutral'
    assert ctx['has_previous_calls'] is False
    print("  ✓ customer context from None")


# ═══════════════════════════════════════════════════════════════════════════
# Test: Reward Computation
# ═══════════════════════════════════════════════════════════════════════════

def test_reward_resolved_happy():
    """Resolved + satisfied customer = high reward."""
    r = compute_reward({
        'resolution_status': 'Resolved',
        'emotion_score': 0.9,
        'duration': 120,
        'avg_resolution_time': 300,
    })
    # 0.6*1 + 0.2*0.9 + 0.1*speed - 0.1*0 = 0.6 + 0.18 + 0.1*(1-120/600) = 0.6+0.18+0.08 = 0.86
    assert r > 0.7, f"Expected > 0.7, got {r}"
    print(f"  ✓ reward resolved+happy = {r}")


def test_reward_escalated_frustrated():
    """Escalated + frustrated = low/negative reward."""
    r = compute_reward({
        'resolution_status': 'Escalated',
        'emotion_score': 0.1,
        'duration': 600,
        'avg_resolution_time': 300,
    })
    # 0.6*0 + 0.2*0.1 + 0.1*speed - 0.1*1
    assert r < 0.2, f"Expected < 0.2, got {r}"
    print(f"  ✓ reward escalated+frustrated = {r}")


def test_reward_pending_neutral():
    """Pending + neutral = medium reward."""
    r = compute_reward({
        'resolution_status': 'Pending',
        'emotion_score': 0.5,
        'duration': 300,
        'avg_resolution_time': 300,
    })
    assert 0.0 < r < 0.5, f"Expected between 0 and 0.5, got {r}"
    print(f"  ✓ reward pending+neutral = {r}")


def test_reward_no_data():
    """Missing data should produce a neutral reward without crashing."""
    r = compute_reward({})
    assert isinstance(r, float)
    print(f"  ✓ reward no data = {r}")


# ═══════════════════════════════════════════════════════════════════════════
# Runner
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    print("\n=== Routing State Tests ===")
    test_emotion_encoding()
    test_category_encoding()
    test_expertise_encoding()
    test_specialization_encoding()
    test_skill_match()
    test_state_vector_dimensions()
    test_build_state_vector()
    test_build_state_vector_missing_data()
    test_customer_context_from_last_call()
    test_customer_context_from_none()

    print("\n=== Reward Computation Tests ===")
    test_reward_resolved_happy()
    test_reward_escalated_frustrated()
    test_reward_pending_neutral()
    test_reward_no_data()

    print("\n✅ All tests passed!")
