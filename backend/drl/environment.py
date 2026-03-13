"""
Simulated Call-Center Environment for DRL training.

Gym-like interface (reset / step) that models incoming calls,
agent pools, and stochastic call outcomes.

State vector (per step):
    [emotion_score(1), issue_category_onehot(5), expertise_level(1),
     agent_0_skill_match, agent_0_workload, agent_0_performance,
     agent_1_skill_match, agent_1_workload, agent_1_performance,
     ...  (repeated for max_agents slots, zero-padded)]

Action: integer index into the available-agent list (0 .. max_agents-1).

Reward: same formula as utils.reward.compute_reward.
"""

import math
import random
import numpy as np

ISSUE_CATEGORIES = ['Sales', 'Technical', 'Billing', 'General', 'Other']
EXPERTISE_MAP = {'Beginner': 0.0, 'Intermediate': 0.5, 'Expert': 1.0}
EXPERTISE_LEVELS = list(EXPERTISE_MAP.keys())

# Feature counts
NUM_CATEGORIES = len(ISSUE_CATEGORIES)
CALL_FEATURES = 1 + NUM_CATEGORIES + 1  # emotion + onehot + expertise = 7
AGENT_FEATURES = 3  # skill_match, workload_norm, performance


class CallCenterEnv:
    """Lightweight Gym-style environment — no gym dependency required."""

    def __init__(self, num_agents: int = 5, max_agents: int = 10):
        assert 1 <= num_agents <= max_agents
        self.num_agents = num_agents
        self.max_agents = max_agents

        # Observation / action dimensions
        self.state_dim = CALL_FEATURES + max_agents * AGENT_FEATURES
        self.action_dim = max_agents

        # Generate fixed agent profiles for this env instance
        self._agent_skills = self._random_skill_vectors(num_agents)
        self._agent_performance = [random.uniform(0.3, 0.9) for _ in range(num_agents)]
        self._agent_workload = [0] * num_agents

        self._current_state = None
        self._current_call = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def reset(self):
        """Sample a new incoming call and return the observation vector."""
        self._current_call = self._sample_call()
        # Reset workloads with small random values
        self._agent_workload = [random.randint(0, 3) for _ in range(self.num_agents)]
        self._current_state = self._build_state(self._current_call)
        return self._current_state.copy()

    def step(self, action: int):
        """Execute routing action, return (next_state, reward, done, info)."""
        call = self._current_call
        if action < 0 or action >= self.num_agents:
            # Invalid action → penalty, episode ends
            return self._current_state.copy(), -10.0, True, {'valid': False}

        skill_match = self._skill_match(action, call['category_idx'])
        workload_norm = self._agent_workload[action] / max(1, max(self._agent_workload))

        # --- Stochastic outcome ---
        resolve_prob = self._sigmoid(skill_match * 3.0 - 1.5 + random.gauss(0, 0.3))
        resolved = random.random() < resolve_prob
        escalated = (not resolved) and (random.random() < 0.3)

        # Emotion trajectory
        if skill_match > 0.6:
            emotion_delta = random.uniform(0.0, 0.15)
        elif skill_match < 0.3:
            emotion_delta = random.uniform(-0.2, 0.0)
        else:
            emotion_delta = random.uniform(-0.05, 0.05)
        final_emotion = max(0, min(1, call['emotion'] + emotion_delta))

        # Handle time (seconds): inversely correlated with skill
        base_time = random.uniform(180, 600)
        handle_time = base_time * (1.3 - skill_match * 0.6)

        # Queue wait (seconds)
        queue_wait = workload_norm * random.uniform(30, 120)

        # Is repeat call?
        is_repeat = random.random() < 0.15  # 15% chance in simulation

        # Resolution status string
        if resolved:
            resolution = 'Resolved'
        elif escalated:
            resolution = 'Escalated'
        else:
            resolution = 'Pending'

        # --- Reward ---
        reward = self._compute_reward(
            resolution, final_emotion, int(handle_time), queue_wait, is_repeat
        )

        # Update agent workload
        self._agent_workload[action] = min(self._agent_workload[action] + 1, 10)

        done = True  # Each episode = one routing decision
        info = {
            'valid': True,
            'resolved': resolved,
            'escalated': escalated,
            'skill_match': round(skill_match, 3),
            'handle_time': round(handle_time, 1),
            'final_emotion': round(final_emotion, 3),
            'resolution': resolution,
        }
        return self._current_state.copy(), reward, done, info

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _sample_call(self) -> dict:
        cat_idx = random.randint(0, NUM_CATEGORIES - 1)
        expertise_key = random.choice(EXPERTISE_LEVELS)
        return {
            'emotion': random.uniform(0.1, 0.9),
            'category_idx': cat_idx,
            'expertise': EXPERTISE_MAP[expertise_key],
        }

    def _build_state(self, call: dict) -> np.ndarray:
        vec = np.zeros(self.state_dim, dtype=np.float32)
        # Call features
        vec[0] = call['emotion']
        vec[1 + call['category_idx']] = 1.0  # one-hot
        vec[1 + NUM_CATEGORIES] = call['expertise']
        # Agent features (zero-padded beyond num_agents)
        offset = CALL_FEATURES
        max_wl = max(1, max(self._agent_workload))
        for i in range(self.num_agents):
            base = offset + i * AGENT_FEATURES
            vec[base] = self._skill_match(i, call['category_idx'])
            vec[base + 1] = self._agent_workload[i] / max_wl
            vec[base + 2] = self._agent_performance[i]
        return vec

    def _skill_match(self, agent_idx: int, category_idx: int) -> float:
        return self._agent_skills[agent_idx][category_idx]

    def _random_skill_vectors(self, n: int):
        """Generate n random skill vectors (one per agent)."""
        vecs = []
        for _ in range(n):
            # Each agent has a specialty (high skill in 1-2 categories)
            skills = [random.uniform(0.2, 0.5) for _ in range(NUM_CATEGORIES)]
            specialty = random.sample(range(NUM_CATEGORIES), k=random.randint(1, 2))
            for s in specialty:
                skills[s] = random.uniform(0.7, 1.0)
            vecs.append(skills)
        return vecs

    @staticmethod
    def _sigmoid(x: float) -> float:
        return 1.0 / (1.0 + math.exp(-x))

    @staticmethod
    def _compute_reward(resolution, emotion, duration_sec, queue_wait_sec, is_repeat):
        reward = 0.0
        if resolution == 'Resolved':
            reward += 10.0
        elif resolution == 'Escalated':
            reward -= 10.0
        if is_repeat:
            reward -= 5.0
        if emotion < 0.3:
            reward -= 15.0
        if resolution == 'Resolved' and duration_sec < 600:
            reward += 5.0
        if queue_wait_sec > 0:
            reward -= 2.0 * (queue_wait_sec / 60.0)
        return round(reward, 2)
