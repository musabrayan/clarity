

import random
import math
from collections import deque

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim


class QNetwork(nn.Module):
    """Simple 3-layer MLP Q-function."""

    def __init__(self, state_dim: int, action_dim: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, action_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class ReplayBuffer:
    """Fixed-size FIFO experience replay buffer."""

    def __init__(self, capacity: int = 50_000):
        self.buffer = deque(maxlen=capacity)

    def push(self, state, action, reward, next_state, done):
        self.buffer.append((state, action, reward, next_state, done))

    def sample(self, batch_size: int):
        batch = random.sample(self.buffer, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        return (
            np.array(states, dtype=np.float32),
            np.array(actions, dtype=np.int64),
            np.array(rewards, dtype=np.float32),
            np.array(next_states, dtype=np.float32),
            np.array(dones, dtype=np.float32),
        )

    def __len__(self):
        return len(self.buffer)


class DQNAgent:
    """DQN agent with target network and ε-greedy exploration."""

    def __init__(
        self,
        state_dim: int,
        action_dim: int,
        lr: float = 1e-3,
        gamma: float = 0.99,
        tau: float = 0.005,
        eps_start: float = 1.0,
        eps_end: float = 0.01,
        eps_decay_steps: int = 10_000,
        buffer_capacity: int = 50_000,
        batch_size: int = 64,
        device: str | None = None,
    ):
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.device = torch.device(device)

        self.state_dim = state_dim
        self.action_dim = action_dim
        self.gamma = gamma
        self.tau = tau
        self.batch_size = batch_size

        # Epsilon schedule
        self.eps_start = eps_start
        self.eps_end = eps_end
        self.eps_decay_steps = eps_decay_steps
        self._step_count = 0

        # Networks
        self.q_net = QNetwork(state_dim, action_dim).to(self.device)
        self.target_net = QNetwork(state_dim, action_dim).to(self.device)
        self.target_net.load_state_dict(self.q_net.state_dict())
        self.target_net.eval()

        self.optimizer = optim.Adam(self.q_net.parameters(), lr=lr)
        self.replay = ReplayBuffer(buffer_capacity)

    @property
    def epsilon(self) -> float:
        t = min(self._step_count / max(1, self.eps_decay_steps), 1.0)
        return self.eps_start + (self.eps_end - self.eps_start) * t

    def select_action(self, state: np.ndarray, num_valid_actions: int | None = None) -> int:
        """ε-greedy action selection.  Only considers actions 0..num_valid_actions-1."""
        if num_valid_actions is None:
            num_valid_actions = self.action_dim

        if random.random() < self.epsilon:
            return random.randint(0, num_valid_actions - 1)

        with torch.no_grad():
            s = torch.tensor(state, dtype=torch.float32, device=self.device).unsqueeze(0)
            q_values = self.q_net(s).squeeze(0)
            # Mask invalid actions to -inf
            mask = torch.full((self.action_dim,), float('-inf'), device=self.device)
            mask[:num_valid_actions] = 0.0
            return int((q_values + mask).argmax().item())

    def select_action_greedy(self, state: np.ndarray, num_valid_actions: int | None = None) -> int:
        """Pure greedy action selection (for inference / evaluation)."""
        if num_valid_actions is None:
            num_valid_actions = self.action_dim

        with torch.no_grad():
            s = torch.tensor(state, dtype=torch.float32, device=self.device).unsqueeze(0)
            q_values = self.q_net(s).squeeze(0)
            mask = torch.full((self.action_dim,), float('-inf'), device=self.device)
            mask[:num_valid_actions] = 0.0
            return int((q_values + mask).argmax().item())

    def store_transition(self, state, action, reward, next_state, done):
        self.replay.push(state, action, reward, next_state, done)
        self._step_count += 1

    def train_step(self) -> float | None:
        """Sample a batch, compute TD loss, update Q-network and soft-update target.
        Returns the loss value, or None if buffer is too small."""
        if len(self.replay) < self.batch_size:
            return None

        states, actions, rewards, next_states, dones = self.replay.sample(self.batch_size)

        states_t = torch.tensor(states, device=self.device)
        actions_t = torch.tensor(actions, device=self.device).unsqueeze(1)
        rewards_t = torch.tensor(rewards, device=self.device).unsqueeze(1)
        next_states_t = torch.tensor(next_states, device=self.device)
        dones_t = torch.tensor(dones, device=self.device).unsqueeze(1)

        # Current Q-values for chosen actions
        q_values = self.q_net(states_t).gather(1, actions_t)

        # Target Q-values (no grad)
        with torch.no_grad():
            max_next_q = self.target_net(next_states_t).max(dim=1, keepdim=True).values
            targets = rewards_t + self.gamma * max_next_q * (1.0 - dones_t)

        loss = nn.functional.mse_loss(q_values, targets)

        self.optimizer.zero_grad()
        loss.backward()
        # Gradient clipping for stability
        nn.utils.clip_grad_norm_(self.q_net.parameters(), max_norm=10.0)
        self.optimizer.step()

        # Soft update target network
        self._soft_update()

        return loss.item()

    def _soft_update(self):
        for tp, sp in zip(self.target_net.parameters(), self.q_net.parameters()):
            tp.data.copy_(self.tau * sp.data + (1.0 - self.tau) * tp.data)

    # ------------------------------------------------------------------
    # Save / Load
    # ------------------------------------------------------------------

    def save(self, path: str):
        torch.save({
            'q_net': self.q_net.state_dict(),
            'target_net': self.target_net.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'step_count': self._step_count,
            'state_dim': self.state_dim,
            'action_dim': self.action_dim,
        }, path)

    def load(self, path: str):
        ckpt = torch.load(path, map_location=self.device, weights_only=True)
        self.q_net.load_state_dict(ckpt['q_net'])
        self.target_net.load_state_dict(ckpt['target_net'])
        if 'optimizer' in ckpt:
            self.optimizer.load_state_dict(ckpt['optimizer'])
        self._step_count = ckpt.get('step_count', 0)
