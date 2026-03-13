"""
Reward computation for DRL-based call routing.

Implements the MDP reward function:
    +10  if resolved (resolutionStatus == "Resolved")
    -10  if escalated (resolutionStatus == "Escalated")
     -5  if repeat call (same customer + same issueCategory within 7 days)
    -15  if sentiment drops (emotionScore < 0.3  →  frustrated customer)
     +5  if quick resolution (call duration < 600 seconds)
     -2  per minute of queue wait time
"""
import logging

logger = logging.getLogger(__name__)

ISSUE_CATEGORIES = ['Sales', 'Technical', 'Billing', 'General', 'Other']


def compute_reward(
    resolution_status: str,
    emotion_score: float,
    issue_category: str,
    duration_sec: int,
    queue_wait_sec: float = 0.0,
    is_repeat_call: bool = False,
) -> float:
    """Return the scalar reward for a single routing decision.

    All inputs come from the AI analysis pipeline output and call metadata.
    """
    reward = 0.0

    # Resolution outcome
    if resolution_status == 'Resolved':
        reward += 10.0
    elif resolution_status == 'Escalated':
        reward -= 10.0

    # Repeat call penalty
    if is_repeat_call:
        reward -= 5.0

    # Sentiment drop — frustrated customer
    if emotion_score is not None and emotion_score < 0.3:
        reward -= 15.0

    # Quick resolution bonus (under 10 minutes)
    if resolution_status == 'Resolved' and duration_sec < 600:
        reward += 5.0

    # Queue wait penalty: -2 per full minute waited
    if queue_wait_sec > 0:
        reward -= 2.0 * (queue_wait_sec / 60.0)

    return round(reward, 2)
