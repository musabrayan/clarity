"""
DRL Router — live inference wrapper for call routing.

Loads the trained DQN checkpoint once (singleton) and exposes
`select_agent(call_state, available_agents)` for the routing endpoint.

Fallback chain:
    1. DRL model (if checkpoint available)
    2. Skill-match heuristic
    3. First available agent (original behaviour)
"""

import logging
from pathlib import Path

import numpy as np

from drl.environment import (
    ISSUE_CATEGORIES,
    EXPERTISE_MAP,
    NUM_CATEGORIES,
    CALL_FEATURES,
    AGENT_FEATURES,
)

logger = logging.getLogger(__name__)

CHECKPOINT_PATH = Path(__file__).resolve().parent / 'checkpoints' / 'dqn_routing_best.pt'
# Fallback to regular checkpoint if best doesn't exist
CHECKPOINT_FALLBACK = Path(__file__).resolve().parent / 'checkpoints' / 'dqn_routing.pt'

MAX_AGENTS = 10  # must match training config


def _try_load_agent():
    """Attempt to load the DQN agent from checkpoint.  Returns None on failure."""
    try:
        import torch  # noqa: F401
        from drl.model import DQNAgent

        path = CHECKPOINT_PATH if CHECKPOINT_PATH.exists() else CHECKPOINT_FALLBACK
        if not path.exists():
            logger.warning("No DRL checkpoint found — DRL routing unavailable")
            return None

        state_dim = CALL_FEATURES + MAX_AGENTS * AGENT_FEATURES
        action_dim = MAX_AGENTS
        agent = DQNAgent(state_dim=state_dim, action_dim=action_dim)
        agent.load(str(path))
        logger.info(f"DRL model loaded from {path}")
        return agent
    except Exception as e:
        logger.warning(f"Failed to load DRL model: {e}")
        return None


class DRLRouter:
    """Singleton router that uses the trained DQN for agent selection."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._agent = _try_load_agent()
        return cls._instance

    def reload_model(self):
        """Force-reload the model (e.g. after retraining)."""
        self._agent = _try_load_agent()

    @property
    def is_available(self) -> bool:
        return self._agent is not None

    def select_agent(
        self,
        emotion_score: float,
        issue_category: str,
        expertise_level: str,
        agent_profiles: dict,
    ) -> tuple[str | None, str]:
        """Select the best agent for the incoming call.

        Parameters
        ----------
        emotion_score : float (0-1) from customer's last call, or 0.5 default
        issue_category : str — one of ISSUE_CATEGORIES
        expertise_level : str — Beginner / Intermediate / Expert
        agent_profiles : dict  {agent_id_str: {skill_vector, current_workload,
                                              performance_metrics}}

        Returns
        -------
        (selected_agent_id, method)  where method is 'drl' | 'skill' | 'fallback'
        """
        agent_ids = list(agent_profiles.keys())
        if not agent_ids:
            return None, 'fallback'

        if len(agent_ids) == 1:
            return agent_ids[0], 'fallback'

        # --- Try DRL ---
        if self._agent is not None:
            try:
                state = self._build_state(
                    emotion_score, issue_category, expertise_level, agent_profiles, agent_ids
                )
                action = self._agent.select_action_greedy(
                    state, num_valid_actions=min(len(agent_ids), MAX_AGENTS)
                )
                if 0 <= action < len(agent_ids):
                    logger.info(f"DRL selected agent index {action} → {agent_ids[action]}")
                    return agent_ids[action], 'drl'
            except Exception as e:
                logger.warning(f"DRL inference failed: {e} — falling back to skill match")

        # --- Fallback: skill-match heuristic ---
        return self._skill_match_select(issue_category, agent_profiles, agent_ids), 'skill'

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _build_state(self, emotion, category, expertise, profiles, agent_ids):
        """Build the state vector matching the training environment layout."""
        state_dim = CALL_FEATURES + MAX_AGENTS * AGENT_FEATURES
        vec = np.zeros(state_dim, dtype=np.float32)

        # Call features
        vec[0] = emotion
        cat_idx = ISSUE_CATEGORIES.index(category) if category in ISSUE_CATEGORIES else 3  # General
        vec[1 + cat_idx] = 1.0
        vec[1 + NUM_CATEGORIES] = EXPERTISE_MAP.get(expertise, 0.5)

        # Agent features
        num_agents = min(len(agent_ids), MAX_AGENTS)
        max_wl = max(1, max(
            p.get('current_workload', 0) for p in profiles.values()
        ))
        for i in range(num_agents):
            aid = agent_ids[i]
            prof = profiles[aid]
            sv = prof.get('skill_vector', {})
            skill_match = sv.get(category, 0.5) if category in sv else 0.5
            wl = prof.get('current_workload', 0) / max_wl
            perf = prof.get('performance_metrics', {}).get('avg_resolution_rate', 0.5)

            base = CALL_FEATURES + i * AGENT_FEATURES
            vec[base] = skill_match
            vec[base + 1] = wl
            vec[base + 2] = perf

        return vec

    @staticmethod
    def _skill_match_select(category, profiles, agent_ids):
        """Simple heuristic: highest skill_vector[category] with lowest workload."""
        best_id = agent_ids[0]
        best_score = -1.0
        for aid in agent_ids:
            prof = profiles[aid]
            sv = prof.get('skill_vector', {})
            skill = sv.get(category, 0.5) if category in sv else 0.5
            wl = prof.get('current_workload', 0)
            # Score: skill - small workload penalty
            score = skill - 0.05 * wl
            if score > best_score:
                best_score = score
                best_id = aid
        return best_id


# Module-level singleton
drl_router = DRLRouter()
