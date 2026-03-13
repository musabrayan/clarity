"""
DRL-based call routing engine using Policy Gradient (REINFORCE).

Uses:
  - Embedding layers for categorical features (integer-encoded)
  - MLP policy head that outputs a score per agent
  - Prioritized Experience Replay for training
  - Agent pre-filtering (online + load < threshold + specialization match)
  - Exploration: random agent from lowest-load bucket
  - Last-spoken-agent priority (Tier 1 before DRL)
"""

import os
import random
import logging
import math
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

# ── Lazy PyTorch imports (heavy) ─────────────────────────────────────────────
_torch = None
_nn = None
_optim = None
_F = None


def _lazy_torch():
    """Import torch lazily so the module can be imported even if torch is missing."""
    global _torch, _nn, _optim, _F
    if _torch is None:
        import torch
        import torch.nn as nn
        import torch.optim as optim
        import torch.nn.functional as F
        _torch = torch
        _nn = nn
        _optim = optim
        _F = F
    return _torch, _nn, _optim, _F


# ── Constants ────────────────────────────────────────────────────────────────
from utils.routing_state import (
    NUM_EMOTIONS, NUM_CATEGORIES, NUM_EXPERTISE, NUM_SPECIALIZATIONS,
    NUM_CONTINUOUS, STATE_DIM,
    build_state_vector, build_customer_context_from_last_call,
    compute_skill_match, compute_reward,
)

EMBED_DIM = 8                # dimensionality of each embedding
HIDDEN_1 = 128
HIDDEN_2 = 64
LEARNING_RATE = 1e-3

# Exploration
EPSILON_START = 0.3
EPSILON_END = 0.05
EPSILON_DECAY = 500          # episodes for decay

# Agent filtering
LOAD_THRESHOLD = 5           # max concurrent calls before filtering out
MIN_SKILL_MATCH = 0.0        # 0 = allow all; raise to 0.5 to require partial match

MODEL_FILENAME = 'drl_routing_model.pth'


# ═════════════════════════════════════════════════════════════════════════════
# Policy Network
# ═════════════════════════════════════════════════════════════════════════════
class RoutingPolicyNetwork:
    """Wrapper around the PyTorch policy network (created lazily)."""

    def __init__(self, model_dir='models'):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self._net = None
        self._optimizer = None
        self._step_count = 0
        self._is_trained = False

    # ── lazy init ────────────────────────────────────────────────────
    def _ensure_net(self):
        if self._net is not None:
            return
        torch, nn, optim, F = _lazy_torch()

        class _PolicyNet(nn.Module):
            def __init__(self):
                super().__init__()
                self.emb_emotion = nn.Embedding(NUM_EMOTIONS, EMBED_DIM)
                self.emb_category = nn.Embedding(NUM_CATEGORIES, EMBED_DIM)
                self.emb_expertise = nn.Embedding(NUM_EXPERTISE, EMBED_DIM)
                self.emb_specialization = nn.Embedding(NUM_SPECIALIZATIONS, EMBED_DIM)

                input_dim = 4 * EMBED_DIM + NUM_CONTINUOUS  # embeddings + continuous
                self.fc1 = nn.Linear(input_dim, HIDDEN_1)
                self.fc2 = nn.Linear(HIDDEN_1, HIDDEN_2)
                self.fc3 = nn.Linear(HIDDEN_2, 1)          # score per (customer, agent) pair

                self.dropout = nn.Dropout(0.1)

            def forward(self, x_cat, x_cont):
                """
                x_cat:  (batch, 4) long tensor  – [emotion, category, expertise, specialization]
                x_cont: (batch, NUM_CONTINUOUS) float tensor
                """
                e1 = self.emb_emotion(x_cat[:, 0])
                e2 = self.emb_category(x_cat[:, 1])
                e3 = self.emb_expertise(x_cat[:, 2])
                e4 = self.emb_specialization(x_cat[:, 3])

                x = torch.cat([e1, e2, e3, e4, x_cont], dim=1)
                x = F.relu(self.fc1(x))
                x = self.dropout(x)
                x = F.relu(self.fc2(x))
                x = self.fc3(x)
                return x.squeeze(-1)          # (batch,)

        self._net = _PolicyNet()
        self._optimizer = optim.Adam(self._net.parameters(), lr=LEARNING_RATE)

        # Try to load saved weights
        weight_path = self.model_dir / MODEL_FILENAME
        if weight_path.exists():
            try:
                self._net.load_state_dict(torch.load(weight_path, map_location='cpu'))
                self._is_trained = True
                logger.info(f"Loaded DRL model weights from {weight_path}")
            except Exception as e:
                logger.warning(f"Could not load model weights: {e}")

    # ── inference ────────────────────────────────────────────────────
    def score_agents(self, state_vectors):
        """Score a list of state vectors (one per candidate agent).

        Args:
            state_vectors: list of lists, each of length STATE_DIM

        Returns:
            numpy array of scores (higher = better)
        """
        self._ensure_net()
        torch = _torch

        if not state_vectors:
            return np.array([])

        self._net.eval()
        with torch.no_grad():
            cat_data = []
            cont_data = []
            for sv in state_vectors:
                cat_data.append(sv[:4])
                cont_data.append(sv[4:])

            x_cat = torch.tensor(cat_data, dtype=torch.long)
            x_cont = torch.tensor(cont_data, dtype=torch.float32)
            scores = self._net(x_cat, x_cont).numpy()

        return scores

    # ── training ─────────────────────────────────────────────────────
    def train_batch(self, experiences, weights):
        """Train on a batch from prioritized replay.

        Uses REINFORCE-style policy gradient:
            loss = -sum( weight_i * reward_i * log_prob_i )

        Args:
            experiences: list of dicts with state, reward, actionIndex
            weights: list of importance-sampling weights

        Returns:
            float average loss
        """
        self._ensure_net()
        torch = _torch
        F = _F

        if not experiences:
            return 0.0

        self._net.train()

        # Build batch tensors
        cat_batch = []
        cont_batch = []
        rewards = []
        is_weights = []

        for exp, w in zip(experiences, weights):
            state = exp['state']
            cat_batch.append(state[:4])
            cont_batch.append(state[4:])
            rewards.append(exp['reward'])
            is_weights.append(w)

        x_cat = torch.tensor(cat_batch, dtype=torch.long)
        x_cont = torch.tensor(cont_batch, dtype=torch.float32)
        reward_t = torch.tensor(rewards, dtype=torch.float32)
        weight_t = torch.tensor(is_weights, dtype=torch.float32)

        # Forward
        scores = self._net(x_cat, x_cont)             # (batch,)
        log_probs = F.log_softmax(scores, dim=0)       # normalise across batch

        # Policy gradient loss: -weight * reward * log_prob
        loss = -(weight_t * reward_t * log_probs).mean()

        self._optimizer.zero_grad()
        loss.backward()

        # Gradient clipping for stability
        torch.nn.utils.clip_grad_norm_(self._net.parameters(), max_norm=1.0)

        self._optimizer.step()
        self._step_count += 1
        self._is_trained = True

        return loss.item()

    # ── persistence ──────────────────────────────────────────────────
    def save(self):
        """Save model weights to disk."""
        self._ensure_net()
        weight_path = self.model_dir / MODEL_FILENAME
        _torch.save(self._net.state_dict(), weight_path)
        logger.info(f"Saved DRL model weights to {weight_path}")

    @property
    def is_trained(self):
        self._ensure_net()
        return self._is_trained

    @property
    def step_count(self):
        return self._step_count


# ═════════════════════════════════════════════════════════════════════════════
# DRL Call Router (main interface)
# ═════════════════════════════════════════════════════════════════════════════
class DRLCallRouter:
    """Intelligent call routing with last-agent priority + DRL policy."""

    def __init__(self):
        model_dir = os.getenv('MODELS_PATH', 'models')
        self.policy = RoutingPolicyNetwork(model_dir=model_dir)
        self._episode_count = 0
        logger.info("DRLCallRouter initialized")

    # ── Epsilon ──────────────────────────────────────────────────────
    @property
    def epsilon(self):
        return EPSILON_END + (EPSILON_START - EPSILON_END) * math.exp(
            -self._episode_count / EPSILON_DECAY
        )

    # ── Pre-filter ───────────────────────────────────────────────────
    def _prefilter_agents(self, agent_profiles, issue_category):
        """Filter agents: online (implied), load < threshold, specialization match.

        Returns a filtered list of agent profiles.
        """
        filtered = []
        for profile in agent_profiles:
            load = profile.get('currentLoad', 0)
            if load >= LOAD_THRESHOLD:
                continue

            # Specialization match: allow General or matching category
            spec = profile.get('specialization', 'General')
            if spec != 'General' and issue_category and spec != issue_category:
                skill_score = compute_skill_match(
                    profile.get('skills', []), issue_category
                )
                if skill_score < MIN_SKILL_MATCH:
                    continue

            filtered.append(profile)

        # If all agents were filtered out, relax: return agents below load only
        if not filtered:
            filtered = [p for p in agent_profiles if p.get('currentLoad', 0) < LOAD_THRESHOLD]

        # Still nothing? Return all (no filtering)
        if not filtered:
            filtered = list(agent_profiles)

        return filtered

    # ── Exploration ──────────────────────────────────────────────────
    def _explore(self, agent_profiles):
        """Pick a random agent from the lowest-load bucket."""
        if not agent_profiles:
            return None

        min_load = min(p.get('currentLoad', 0) for p in agent_profiles)
        lowest_load = [p for p in agent_profiles if p.get('currentLoad', 0) == min_load]
        return random.choice(lowest_load)

    # ── Main routing entry point ─────────────────────────────────────
    def select_agent(self, customer_id, online_agent_ids, calls_model, agent_profile_model):
        """Select the optimal agent for a customer.

        Tier 1: Last-spoken agent (if online & passes pre-filter)
        Tier 2: DRL policy scoring on pre-filtered agents
        Fallback: Random from lowest-load agents

        Args:
            customer_id: str or None
            online_agent_ids: set/list of str agent IDs
            calls_model: CallsModel instance
            agent_profile_model: AgentProfileModel instance

        Returns:
            dict {agentId, identity, routing_method}
        """
        if not online_agent_ids:
            return None

        online_list = list(online_agent_ids)

        # ── Get agent profiles for all online agents ─────────────────
        agent_profiles = agent_profile_model.find_all_online(online_list)
        if not agent_profiles:
            # Fallback: pick random online agent
            aid = random.choice(online_list)
            return self._make_result(aid, 'fallback_random')

        # ── Get customer's last call for context ─────────────────────
        last_call = None
        last_agent_id = None
        customer_context = build_customer_context_from_last_call(None)

        if customer_id:
            try:
                recent_calls = calls_model.find_by_customer(customer_id, limit=1)
                if recent_calls:
                    last_call = recent_calls[0]
                    customer_context = build_customer_context_from_last_call(last_call)
                    last_agent_id = str(last_call.get('agentId')) if last_call.get('agentId') else None
            except Exception as e:
                logger.warning(f"Could not fetch customer history: {e}")

        issue_category = customer_context.get('issue_category', 'Other')

        # ── Tier 1: Last-spoken agent ────────────────────────────────
        if last_agent_id and last_agent_id in online_list:
            last_profile = next(
                (p for p in agent_profiles if str(p.get('agentId')) == last_agent_id),
                None
            )
            if last_profile:
                load_ok = last_profile.get('currentLoad', 0) < LOAD_THRESHOLD
                spec = last_profile.get('specialization', 'General')
                spec_ok = (spec == 'General' or spec == issue_category)

                if load_ok and spec_ok:
                    logger.info(f"Routing to last-spoken agent {last_agent_id}")
                    return self._make_result(last_agent_id, 'last_spoken_agent')

        # ── Pre-filter agents ────────────────────────────────────────
        filtered = self._prefilter_agents(agent_profiles, issue_category)

        if len(filtered) == 1:
            aid = str(filtered[0]['agentId'])
            return self._make_result(aid, 'only_eligible')

        # ── Epsilon-greedy exploration ───────────────────────────────
        if random.random() < self.epsilon:
            chosen = self._explore(filtered)
            if chosen:
                self._episode_count += 1
                aid = str(chosen['agentId'])
                logger.info(f"Exploration: selected {aid} (ε={self.epsilon:.3f})")
                return self._make_result(aid, 'exploration')

        # ── Tier 2: DRL Policy scoring ───────────────────────────────
        if self.policy.is_trained:
            try:
                state_vectors = []
                agent_ids = []
                for profile in filtered:
                    aid = str(profile['agentId'])
                    is_last = (aid == last_agent_id) if last_agent_id else False
                    sv = build_state_vector(customer_context, profile, is_last)
                    state_vectors.append(sv)
                    agent_ids.append(aid)

                scores = self.policy.score_agents(state_vectors)
                best_idx = int(np.argmax(scores))
                best_aid = agent_ids[best_idx]

                logger.info(
                    f"DRL selected agent {best_aid} "
                    f"(score={scores[best_idx]:.4f}, "
                    f"agents_evaluated={len(filtered)})"
                )
                self._episode_count += 1
                return self._make_result(best_aid, 'drl_policy')

            except Exception as e:
                logger.error(f"DRL scoring failed, falling back: {e}", exc_info=True)

        # ── Fallback: lowest-load random ─────────────────────────────
        chosen = self._explore(filtered)
        aid = str(chosen['agentId']) if chosen else random.choice(online_list)
        self._episode_count += 1
        return self._make_result(aid, 'fallback_lowest_load')

    # ── Training ─────────────────────────────────────────────────────
    def train(self, routing_experience_model, batch_size=32, n_batches=10):
        """Run training iterations from the replay buffer.

        Returns dict with training stats.
        """
        total_experiences = routing_experience_model.count()
        if total_experiences < batch_size:
            return {
                'success': False,
                'message': f'Not enough experiences ({total_experiences}/{batch_size})',
                'experiences': total_experiences,
            }

        total_loss = 0.0
        batches_run = 0

        for _ in range(n_batches):
            experiences, weights = routing_experience_model.sample_batch(batch_size)
            if not experiences:
                break
            loss = self.policy.train_batch(experiences, weights)
            total_loss += loss
            batches_run += 1

        if batches_run > 0:
            self.policy.save()

        avg_loss = total_loss / batches_run if batches_run > 0 else 0
        return {
            'success': True,
            'batches': batches_run,
            'avg_loss': round(avg_loss, 6),
            'total_experiences': total_experiences,
            'model_steps': self.policy.step_count,
            'epsilon': round(self.epsilon, 4),
        }

    # ── Stats ────────────────────────────────────────────────────────
    def get_stats(self):
        return {
            'model_trained': self.policy.is_trained,
            'training_steps': self.policy.step_count,
            'epsilon': round(self.epsilon, 4),
            'episode_count': self._episode_count,
            'load_threshold': LOAD_THRESHOLD,
        }

    # ── Helpers ──────────────────────────────────────────────────────
    @staticmethod
    def _make_result(agent_id, method):
        return {
            'agentId': agent_id,
            'identity': f'agent_{agent_id}',
            'routing_method': method,
        }


# ── Module-level singleton ───────────────────────────────────────────────────
try:
    drl_router = DRLCallRouter()
except Exception as e:
    logger.error(f"Failed to initialize DRLCallRouter: {e}")
    drl_router = None
