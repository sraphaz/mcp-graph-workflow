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

import type Database from "better-sqlite3";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "agent-activity.ts" });

const HEARTBEAT_TIMEOUT_MS = 60_000; // 60 seconds

export type AgentStatus = "active" | "stale";

export interface AgentActivityInfo {
  agentId: string;
  status: AgentStatus;
  lastHeartbeat: string;
  activeLocks: number;
  currentTaskId: string | null;
}

interface HeartbeatRow {
  agent_id: string;
  last_heartbeat: string;
}

interface LockCountRow {
  agent_id: string;
  lock_count: number;
}

interface TaskLockRow {
  agent_id: string;
  resource_id: string;
}

/**
 * Get agent activity from the database (event_queue + resource_locks).
 * Derives agent status from most recent heartbeat event.
 */
export function getAgentActivity(db: Database.Database): AgentActivityInfo[] {
  log.debug("agent-activity:query");

  const now = Date.now();

  // 1. Get most recent heartbeat per agent from event_queue
  let agents: HeartbeatRow[];
  try {
    agents = db.prepare(`
      SELECT agent_id, MAX(created_at) as last_heartbeat
      FROM event_queue
      WHERE event_type = 'agent:heartbeat'
      GROUP BY agent_id
      ORDER BY last_heartbeat DESC
    `).all() as HeartbeatRow[];
  } catch {
    return [];
  }

  if (agents.length === 0) return [];

  // 2. Count active locks per agent
  const nowIso = new Date().toISOString();
  let lockCounts: LockCountRow[];
  try {
    lockCounts = db.prepare(`
      SELECT agent_id, COUNT(*) as lock_count
      FROM resource_locks
      WHERE expires_at > ?
      GROUP BY agent_id
    `).all(nowIso) as LockCountRow[];
  } catch {
    lockCounts = [];
  }

  const lockMap = new Map<string, number>();
  for (const row of lockCounts) {
    lockMap.set(row.agent_id, row.lock_count);
  }

  // 3. Get current task per agent (from task: locks)
  let taskLocks: TaskLockRow[];
  try {
    taskLocks = db.prepare(`
      SELECT agent_id, resource_id
      FROM resource_locks
      WHERE resource_type = 'task' AND expires_at > ?
    `).all(nowIso) as TaskLockRow[];
  } catch {
    taskLocks = [];
  }

  const taskMap = new Map<string, string>();
  for (const row of taskLocks) {
    // resource_id format: "task:node_abc123" → extract "node_abc123"
    const taskId = row.resource_id.startsWith("task:") ? row.resource_id.slice(5) : row.resource_id;
    taskMap.set(row.agent_id, taskId);
  }

  // 4. Build result
  return agents.map((agent): AgentActivityInfo => {
    const heartbeatTime = new Date(agent.last_heartbeat).getTime();
    const status: AgentStatus = (now - heartbeatTime) > HEARTBEAT_TIMEOUT_MS ? "stale" : "active";

    return {
      agentId: agent.agent_id,
      status,
      lastHeartbeat: agent.last_heartbeat,
      activeLocks: lockMap.get(agent.agent_id) ?? 0,
      currentTaskId: taskMap.get(agent.agent_id) ?? null,
    };
  });
}
