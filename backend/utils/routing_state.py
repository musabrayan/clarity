"""
Feature extraction for DRL call routing.

Uses integer encoding (for embedding layers in the policy network)
and normalized continuous features.
"""

import logging

logger = logging.getLogger(__name__)

# ── Encoding maps ────────────────────────────────────────────────────────────
EMOTION_MAP = {
    'Positive': 0, 'Neutral': 1, 'Negative': 2,
    'Frustrated': 3, 'Satisfied': 4,
}
NUM_EMOTIONS = len(EMOTION_MAP)

CATEGORY_MAP = {
    'Sales': 0, 'Technical': 1, 'Billing': 2,
    'General': 3, 'Other': 4,
}
NUM_CATEGORIES = len(CATEGORY_MAP)

EXPERTISE_MAP = {
    'Beginner': 0, 'Intermediate': 1, 'Expert': 2,
}
NUM_EXPERTISE = len(EXPERTISE_MAP)

# Specialization uses the same encoding as category
SPECIALIZATION_MAP = CATEGORY_MAP
NUM_SPECIALIZATIONS = NUM_CATEGORIES

# ── Feature vector layout ────────────────────────────────────────────────────
# Categorical (integer-encoded, fed to embeddings in the network):
#   [0]  emotion_id
#   [1]  category_id
#   [2]  expertise_id
#   [3]  specialization_id   (agent)
#
# Continuous / binary:
#   [4]  has_previous_calls        0 / 1
#   [5]  previous_resolution_ok    0 / 1
#   [6]  skill_match_score         float [0, 1]
#   [7]  resolution_rate           float [0, 1]
#   [8]  avg_satisfaction          float [0, 1]
#   [9]  current_load_normalized   float [0, 1]
#   [10] is_last_agent             0 / 1

NUM_CATEGORICAL = 4   # indices 0-3
NUM_CONTINUOUS  = 7   # indices 4-10
STATE_DIM       = NUM_CATEGORICAL + NUM_CONTINUOUS   # 11 total

# Normalization constant for agent load
MAX_LOAD = 10


def encode_emotion(label):
    """Map emotion label → integer id."""
    return EMOTION_MAP.get(label, EMOTION_MAP['Neutral'])


def encode_category(label):
    """Map issue category label → integer id."""
    return CATEGORY_MAP.get(label, CATEGORY_MAP['Other'])


def encode_expertise(label):
    """Map expertise level label → integer id."""
    return EXPERTISE_MAP.get(label, EXPERTISE_MAP['Beginner'])


def encode_specialization(label):
    """Map specialization (same domain as category) → integer id."""
    return SPECIALIZATION_MAP.get(label, SPECIALIZATION_MAP['General'])


def compute_skill_match(agent_skills, issue_category):
    """Compute a [0,1] skill-match score.

    Returns 1.0 if the agent has a skill matching the category,
    else falls back to partial credit for 'general'.
    """
    if not agent_skills or not issue_category:
        return 0.0

    cat_lower = issue_category.lower()
    skills_lower = [s.lower() for s in agent_skills]

    if cat_lower in skills_lower:
        return 1.0
    if 'general' in skills_lower:
        return 0.5
    return 0.0


def build_state_vector(customer_context, agent_profile, is_last_agent=False):
    """Build an 11-dim state vector for a (customer, agent) pair.

    Args:
        customer_context: dict with keys:
            - emotion_label: str
            - issue_category: str
            - expertise_level: str
            - has_previous_calls: bool
            - previous_resolution_success: bool
        agent_profile: dict (MongoDB agent_profile document) with keys:
            - specialization: str
            - skills: list[str]
            - resolvedCalls, totalCalls, avgSatisfactionScore, currentLoad
        is_last_agent: bool

    Returns:
        list of length STATE_DIM
    """
    try:
        # ── Categorical ──────────────────────────────────────────────
        emotion_id = encode_emotion(customer_context.get('emotion_label'))
        category_id = encode_category(customer_context.get('issue_category'))
        expertise_id = encode_expertise(customer_context.get('expertise_level'))
        specialization_id = encode_specialization(agent_profile.get('specialization', 'General'))

        # ── Continuous / binary ───────────────────────────────────────
        has_prev = 1 if customer_context.get('has_previous_calls') else 0
        prev_ok  = 1 if customer_context.get('previous_resolution_success') else 0

        skill_match = compute_skill_match(
            agent_profile.get('skills', []),
            customer_context.get('issue_category'),
        )

        total_calls = agent_profile.get('totalCalls', 0)
        resolved = agent_profile.get('resolvedCalls', 0)
        resolution_rate = (resolved / total_calls) if total_calls > 0 else 0.5

        avg_sat = agent_profile.get('avgSatisfactionScore', 0.5)
        avg_sat = max(0.0, min(1.0, avg_sat))

        load = agent_profile.get('currentLoad', 0)
        load_norm = min(load / MAX_LOAD, 1.0)

        is_last = 1 if is_last_agent else 0

        return [
            emotion_id,         # 0 – categorical
            category_id,        # 1 – categorical
            expertise_id,       # 2 – categorical
            specialization_id,  # 3 – categorical
            has_prev,           # 4
            prev_ok,            # 5
            skill_match,        # 6
            resolution_rate,    # 7
            avg_sat,            # 8
            load_norm,          # 9
            is_last,            # 10
        ]

    except Exception as e:
        logger.error(f"Error building state vector: {e}", exc_info=True)
        # Return a neutral default
        return [1, 4, 0, 3, 0, 0, 0.0, 0.5, 0.5, 0.0, 0]


def build_customer_context_from_last_call(last_call):
    """Extract customer context from the most recent call document."""
    if not last_call:
        return {
            'emotion_label': 'Neutral',
            'issue_category': 'Other',
            'expertise_level': 'Beginner',
            'has_previous_calls': False,
            'previous_resolution_success': False,
        }

    return {
        'emotion_label': last_call.get('emotionLabel', 'Neutral'),
        'issue_category': last_call.get('issueCategory', 'Other'),
        'expertise_level': last_call.get('expertiseLevel', 'Beginner'),
        'has_previous_calls': True,
        'previous_resolution_success': last_call.get('resolutionStatus') == 'Resolved',
    }


def compute_reward(call_result):
    """Compute the weighted reward for a completed call.

    reward = 0.6 * resolution_success
           + 0.2 * satisfaction_score
           + 0.1 * resolution_speed
           - 0.1 * escalation_penalty

    Args:
        call_result: dict with keys:
            - resolution_status: str  ('Resolved', 'Pending', 'Escalated', ...)
            - emotion_score: float  0-1
            - duration: float  seconds
            - avg_resolution_time: float  baseline seconds for comparison
    """
    resolution_success = 1.0 if call_result.get('resolution_status') == 'Resolved' else 0.0

    satisfaction = float(call_result.get('emotion_score', 0.5))
    satisfaction = max(0.0, min(1.0, satisfaction))

    # Speed: compare duration against the baseline average
    duration = float(call_result.get('duration', 0))
    avg_time = float(call_result.get('avg_resolution_time', 300))
    if avg_time > 0 and duration > 0:
        speed = max(0.0, min(1.0, 1.0 - (duration / (2 * avg_time))))
    else:
        speed = 0.5  # neutral when no data

    escalation = 1.0 if call_result.get('resolution_status') == 'Escalated' else 0.0

    reward = (
        0.6 * resolution_success
        + 0.2 * satisfaction
        + 0.1 * speed
        - 0.1 * escalation
    )

    return round(reward, 4)
