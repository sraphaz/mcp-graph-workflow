/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * OperationalHealthPanel — real-time health metrics for the Agent Operations board.
 *
 * Metrics per agent and globally:
 *   WIP        — in_progress task count
 *   Blocked    — tasks with unresolved blockers
 *   At-risk    — locks expiring within 5 minutes
 *   Throughput — done tasks in the last 24 hours
 *
 * Shows an explanatory empty state when no task data is available.
 */

import React from "react";

// ── Types ─────────────────────────────────────────────────────────

export interface HealthTask {
  id: string;
  agent: string;
  status: string;
  blocked: boolean;
  /** ISO timestamp — task lock expiry (teamTask mode) */
  lockExpiresAt?: string;
  /** ISO timestamp — when the task was completed */
  doneAt?: string;
}

export interface AgentHealthMetric {
  agent: string;
  wip: number;
  blocked: number;
  atRiskLocks: number;
  throughput: number;
}

export interface HealthMetrics {
  agents: AgentHealthMetric[];
  global: {
    totalWip: number;
    totalBlocked: number;
    totalAtRiskLocks: number;
    totalThroughput: number;
  };
  hasData: boolean;
}

export interface OperationalHealthPanelProps {
  tasks?: HealthTask[];
}

// ── Pure logic ────────────────────────────────────────────────────

const AT_RISK_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const THROUGHPUT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export function computeHealthMetrics(tasks: HealthTask[]): HealthMetrics {
  if (tasks.length === 0) {
    return {
      agents: [],
      global: { totalWip: 0, totalBlocked: 0, totalAtRiskLocks: 0, totalThroughput: 0 },
      hasData: false,
    };
  }

  const now = Date.now();
  const agentMap = new Map<string, AgentHealthMetric>();

  for (const task of tasks) {
    if (!agentMap.has(task.agent)) {
      agentMap.set(task.agent, { agent: task.agent, wip: 0, blocked: 0, atRiskLocks: 0, throughput: 0 });
    }
    const m = agentMap.get(task.agent)!;

    if (task.status === "in_progress") {
      m.wip += 1;
      if (task.blocked) m.blocked += 1;
      if (task.lockExpiresAt) {
        const expiresMs = new Date(task.lockExpiresAt).getTime();
        if (expiresMs - now <= AT_RISK_WINDOW_MS && expiresMs > now) {
          m.atRiskLocks += 1;
        }
      }
    }

    if (task.status === "done" && task.doneAt) {
      const doneMs = new Date(task.doneAt).getTime();
      if (now - doneMs <= THROUGHPUT_WINDOW_MS) {
        m.throughput += 1;
      }
    }
  }

  const agents = Array.from(agentMap.values());
  const global = agents.reduce(
    (acc, a) => ({
      totalWip: acc.totalWip + a.wip,
      totalBlocked: acc.totalBlocked + a.blocked,
      totalAtRiskLocks: acc.totalAtRiskLocks + a.atRiskLocks,
      totalThroughput: acc.totalThroughput + a.throughput,
    }),
    { totalWip: 0, totalBlocked: 0, totalAtRiskLocks: 0, totalThroughput: 0 },
  );

  return { agents, global, hasData: true };
}

// ── Component ─────────────────────────────────────────────────────

function MetricBadge({ label, value, warn }: { label: string; value: number; warn?: boolean }): React.ReactElement {
  return (
    <div className="flex flex-col items-center px-3 py-1 rounded bg-neutral-800 min-w-[60px]">
      <span className={`text-lg font-bold tabular-nums ${warn && value > 0 ? "text-amber-400" : "text-neutral-100"}`}>
        {value}
      </span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

export function OperationalHealthPanel({ tasks = [] }: OperationalHealthPanelProps): React.ReactElement {
  const metrics = computeHealthMetrics(tasks);

  if (!metrics.hasData) {
    return (
      <div className="flex items-center justify-center py-8 px-4 text-neutral-500 text-sm empty-state" role="status">
        <span>Sem dados recentes — sem tasks in_progress ou done nas últimas 24h.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Global summary */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-neutral-500 font-semibold uppercase mr-2">Global</span>
        <MetricBadge label="WIP" value={metrics.global.totalWip} />
        <MetricBadge label="Bloqueios" value={metrics.global.totalBlocked} warn />
        <MetricBadge label="At-risk" value={metrics.global.totalAtRiskLocks} warn />
        <MetricBadge label="Throughput" value={metrics.global.totalThroughput} />
      </div>

      {/* Per-agent metrics */}
      {metrics.agents.map((agent) => (
        <div key={agent.agent} className="flex flex-wrap gap-2 items-center border-t border-neutral-800 pt-2">
          <span className="text-xs font-mono text-neutral-400 w-24 truncate" title={agent.agent}>
            {agent.agent}
          </span>
          <MetricBadge label="WIP" value={agent.wip} />
          <MetricBadge label="Blocked" value={agent.blocked} warn />
          <MetricBadge label="At-risk" value={agent.atRiskLocks} warn />
          <MetricBadge label="Throughput" value={agent.throughput} />
        </div>
      ))}
    </div>
  );
}
