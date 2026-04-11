---
name: graph-reinforcement-learning-optimizer
description: Reinforcement learning agent that optimizes task sequencing and decision-making for maximum throughput and minimum cycle time
triggers:
  - graph-reinforcement-learning-optimizer
version: 1.0.0
author: Diego Nogueira
date: 2026-04-10
---

# graph-reinforcement-learning-optimizer

Reinforcement learning skill that trains a local RL agent to optimize graph execution decisions -- task ordering, resource allocation, phase transitions, and scope adjustments. The agent learns from historical execution data to maximize throughput reward while minimizing cycle time and blocked states.

## When to Use

- During PLAN phase -- optimize task ordering within sprints for maximum throughput
- When `next` recommendations feel suboptimal -- RL agent provides alternative sequencing
- After multiple sprints -- enough data to learn optimal policies from execution patterns
- When facing complex dependency graphs -- RL navigates dependency constraints better than heuristic rules
- During resource contention -- RL balances parallel work streams optimally
- Proactively on sprint boundaries -- recalibrate policy with new execution data

## Mandatory Flow

```
define state space --> define action space --> define reward function --> collect experience replay --> train policy network --> evaluate policy --> deploy recommendations --> monitor performance --> write_memory
```

## Workflow

### Step 1: Define State Space

The RL agent observes the current graph state as a feature vector:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

State representation (S):
| Feature | Description | Encoding |
|---------|-------------|----------|
| `wip_count` | Tasks currently in_progress | Numeric |
| `ready_queue_size` | Tasks in ready status | Numeric |
| `blocked_count` | Tasks currently blocked | Numeric |
| `sprint_remaining_hours` | Hours until sprint end | Numeric |
| `dependency_density` | Edges / Nodes ratio | Numeric |
| `avg_task_complexity` | Mean estimated duration of ready tasks | Numeric |
| `critical_path_length` | Longest dependency chain to sprint end | Numeric |
| `velocity_trend` | Rolling 5-task cycle_time derivative | Numeric |
| `phase` | Current lifecycle phase | One-hot |
| `blocker_age_max` | Max hours any task has been blocked | Numeric |
| `knowledge_coverage` | % of ready tasks with RAG context loaded | Numeric |

State is normalized to [0, 1] range using min-max scaling from historical bounds.

### Step 2: Define Action Space

The RL agent selects from discrete actions:

| Action | Description |
|--------|-------------|
| `pick_highest_priority` | Select the highest priority ready task |
| `pick_most_blocking` | Select the task that unblocks the most downstream work |
| `pick_shortest_first` | Select the task with shortest predicted duration |
| `pick_critical_path` | Select the task on the critical path |
| `unblock_first` | Focus on resolving the oldest blocked task |
| `decompose_large` | Break down the largest ready task before starting |
| `load_context` | Run rag_context for the top candidate before starting |
| `defer_to_next_sprint` | Move lowest-priority ready task to backlog |
| `reduce_wip` | Finish current in_progress tasks before starting new ones |

Action masking: invalid actions (e.g., `unblock_first` when nothing is blocked) are masked to prevent illegal moves.

### Step 3: Define Reward Function

The reward signal measures execution quality:

```
reward = throughput_reward + efficiency_reward + quality_reward + penalty
```

| Component | Formula | Weight |
|-----------|---------|--------|
| `throughput_reward` | +1.0 per task completed | 0.4 |
| `efficiency_reward` | -0.1 * (actual_duration / predicted_duration - 1) | 0.3 |
| `quality_reward` | +0.5 if AC validated on first attempt | 0.2 |
| `wip_penalty` | -0.3 * max(0, wip_count - 1) | 0.1 |
| `blocked_penalty` | -0.2 per task blocked > 24h | - |
| `phase_drift_penalty` | -1.0 if sprint completion P80 exceeds deadline | - |

Discount factor: `gamma = 0.95` (future rewards are slightly discounted).

### Step 4: Collect Experience Replay

Build the experience replay buffer from historical graph execution:

```
Tool: mcp__mcp-graph__metrics (type: "cycle_time")
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

For each historical decision point (task selection), record:
- State `s_t`: graph state at decision time
- Action `a_t`: which task was selected
- Reward `r_t`: computed reward from outcome
- Next state `s_{t+1}`: graph state after task completion

Minimum buffer size: 100 experience tuples. Use prioritized experience replay (PER) to oversample rare high-reward or high-penalty experiences.

### Step 5: Train Policy Network

Train a lightweight policy network locally:

- **Algorithm**: Proximal Policy Optimization (PPO) for stability
- **Architecture**: MLP with 2 hidden layers (64, 32 neurons), ReLU activation
- **Training**: 50 epochs over replay buffer, batch size 32
- **Learning rate**: 3e-4 with linear decay
- **Clip ratio**: 0.2 (PPO clipping for stable updates)
- **Entropy bonus**: 0.01 (encourage exploration in early training)

Validation:
- Hold out 20% of experience buffer for validation
- Compare policy actions against historical `next` recommendations
- Track cumulative reward on validation set

```
Tool: mcp__mcp-graph__write_memory (title: "RL Policy — Training Report", content: <training curves, validation metrics, policy version>)
```

### Step 6: Evaluate Policy Quality

Before deploying, evaluate the trained policy:

```
Tool: mcp__mcp-graph__forecast (mode: "dora")
Tool: mcp__mcp-graph__metrics (type: "velocity")
```

Evaluation criteria:
| Metric | Threshold | Description |
|--------|-----------|-------------|
| `avg_reward` | > baseline (heuristic `next`) | Mean reward per episode |
| `throughput_improvement` | > 0% | Tasks/day vs heuristic |
| `cycle_time_reduction` | > 0% | Avg cycle_time vs heuristic |
| `blocked_time_reduction` | > 0% | Total blocked hours vs heuristic |
| `action_diversity` | > 3 unique actions used | Not stuck on one strategy |

If the policy underperforms baseline on any metric, fall back to heuristic `next` and log the failure for investigation.

### Step 7: Deploy Recommendations

When the policy passes evaluation, integrate with task selection:

```
Tool: mcp__mcp-graph__analyze (mode: "progress")
```

The RL agent provides a ranked list of recommended actions alongside the standard `next` recommendation. The human or orchestrating agent makes the final decision.

Output per recommendation:
- Recommended action and target task
- Expected reward (Q-value)
- Confidence (policy probability)
- Explanation: which state features drove this recommendation

### Step 8: Monitor and Adapt

Continuously monitor policy performance in production:

- Track actual reward vs predicted reward per decision
- Detect policy degradation: rolling 10-decision average reward dropping below baseline
- Trigger retraining when performance degrades by >15%
- Log all decisions for future replay buffer augmentation

```
Tool: mcp__mcp-graph__metrics (type: "velocity")
Tool: mcp__mcp-graph__write_memory (title: "RL Optimizer — Performance Monitor <date>", content: <decisions, rewards, drift metrics>)
```

## Output Format

```
Phase: RL OPTIMIZATION
Experience Buffer: <N> tuples (<N> episodes)
Policy Version: <N> (trained <date>)
Training: avg_reward=<N>, validation_reward=<N>, epochs=<N>
Evaluation vs Baseline:
  Throughput: <N>% <improvement|regression>
  Cycle Time: <N>% <reduction|increase>
  Blocked Time: <N>% <reduction|increase>
Recommendations:
  1. <action>: <task_id> (Q=<N>, confidence=<N>%)
  2. <action>: <task_id> (Q=<N>, confidence=<N>%)
  3. <action>: <task_id> (Q=<N>, confidence=<N>%)
Policy Status: <active | fallback_to_heuristic>

Saved to memory: "RL Optimizer — Performance Monitor <date>"
```

## Anti-Patterns

- Do NOT deploy RL policy without evaluation against baseline -- always A/B test before replacing heuristics
- Do NOT train with fewer than 100 experience tuples -- insufficient data leads to overfitting
- Do NOT use a discount factor of 1.0 -- infinite horizon causes training instability
- Do NOT skip action masking -- illegal actions waste training capacity and confuse the policy
- Do NOT ignore policy degradation -- set up automatic fallback to heuristic `next` when performance drops
- Do NOT over-optimize for throughput alone -- the reward must balance speed, quality, and flow
- Do NOT let the RL agent make irreversible decisions -- it recommends, humans approve
