"""
DRL Training Script for CLARITY Call Routing.

Usage:
    cd backend
    python -m drl.train --episodes 50000 --agents 5
    python -m drl.train --episodes 1000 --agents 3   # quick smoke test
"""

import argparse
import json
import os
import time
from collections import deque
from pathlib import Path

import numpy as np

from drl.environment import CallCenterEnv
from drl.model import DQNAgent

CHECKPOINT_DIR = Path(__file__).resolve().parent / 'checkpoints'


def train(
    episodes: int = 50_000,
    num_agents: int = 5,
    max_agents: int = 10,
    eval_interval: int = 500,
    save_interval: int = 5_000,
    log_interval: int = 100,
):
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    env = CallCenterEnv(num_agents=num_agents, max_agents=max_agents)
    agent = DQNAgent(
        state_dim=env.state_dim,
        action_dim=env.action_dim,
    )

    # Metrics tracking
    reward_window = deque(maxlen=100)
    loss_window = deque(maxlen=100)
    metrics_log = []

    best_avg_reward = float('-inf')
    start_time = time.time()

    print(f"Training DQN — {episodes} episodes, {num_agents} agents")
    print(f"State dim: {env.state_dim}, Action dim: {env.action_dim}")
    print(f"Checkpoint dir: {CHECKPOINT_DIR}")
    print("-" * 60)

    for ep in range(1, episodes + 1):
        state = env.reset()
        action = agent.select_action(state, num_valid_actions=num_agents)
        next_state, reward, done, info = env.step(action)

        agent.store_transition(state, action, reward, next_state, done)
        loss = agent.train_step()

        reward_window.append(reward)
        if loss is not None:
            loss_window.append(loss)

        # Logging
        if ep % log_interval == 0:
            avg_r = np.mean(reward_window)
            avg_l = np.mean(loss_window) if loss_window else 0.0
            elapsed = time.time() - start_time
            eps_per_sec = ep / max(elapsed, 1)
            print(
                f"Ep {ep:>7d}/{episodes} | "
                f"Avg R(100): {avg_r:>7.2f} | "
                f"Avg Loss: {avg_l:>8.4f} | "
                f"ε: {agent.epsilon:.3f} | "
                f"{eps_per_sec:.0f} ep/s"
            )

        # Periodic evaluation (greedy, no exploration)
        if ep % eval_interval == 0:
            eval_rewards = _evaluate(env, agent, num_agents, n=200)
            avg_eval = np.mean(eval_rewards)
            metrics_log.append({
                'episode': ep,
                'avg_train_reward': float(np.mean(reward_window)),
                'avg_eval_reward': float(avg_eval),
                'epsilon': agent.epsilon,
                'avg_loss': float(np.mean(loss_window)) if loss_window else 0.0,
            })
            if avg_eval > best_avg_reward:
                best_avg_reward = avg_eval
                agent.save(str(CHECKPOINT_DIR / 'dqn_routing_best.pt'))
                print(f"  ★ New best eval reward: {avg_eval:.2f} — saved best checkpoint")

        # Periodic save
        if ep % save_interval == 0:
            agent.save(str(CHECKPOINT_DIR / 'dqn_routing.pt'))

    # Final save
    agent.save(str(CHECKPOINT_DIR / 'dqn_routing.pt'))
    with open(CHECKPOINT_DIR / 'training_metrics.json', 'w') as f:
        json.dump(metrics_log, f, indent=2)

    elapsed = time.time() - start_time
    print("-" * 60)
    print(f"Training complete in {elapsed:.1f}s")
    print(f"Best eval reward: {best_avg_reward:.2f}")
    print(f"Model saved to {CHECKPOINT_DIR / 'dqn_routing.pt'}")


def _evaluate(env, agent, num_agents, n=200):
    """Run n greedy episodes and return list of rewards."""
    rewards = []
    for _ in range(n):
        state = env.reset()
        action = agent.select_action_greedy(state, num_valid_actions=num_agents)
        _, reward, _, _ = env.step(action)
        rewards.append(reward)
    return rewards


def main():
    parser = argparse.ArgumentParser(description='Train DRL routing model')
    parser.add_argument('--episodes', type=int, default=50_000)
    parser.add_argument('--agents', type=int, default=5)
    parser.add_argument('--max-agents', type=int, default=10)
    parser.add_argument('--eval-interval', type=int, default=500)
    parser.add_argument('--save-interval', type=int, default=5_000)
    parser.add_argument('--log-interval', type=int, default=100)
    args = parser.parse_args()

    train(
        episodes=args.episodes,
        num_agents=args.agents,
        max_agents=args.max_agents,
        eval_interval=args.eval_interval,
        save_interval=args.save_interval,
        log_interval=args.log_interval,
    )


if __name__ == '__main__':
    main()
