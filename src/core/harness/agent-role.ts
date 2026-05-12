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
 * Agent Role Registration — allows agents to register their role
 * (implementor, reviewer, validator) for a specific task.
 *
 * Persists in project settings as `agent_role_{taskId}`.
 * Used for contract enforcement in multi-agent workflows.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export type AgentRole = "implementor" | "reviewer" | "validator";

export interface AgentRoleRegistration {
  role: AgentRole;
  taskId: string;
  registeredAt: string;
  warning?: string;
}

export interface StoredAgentRole {
  role: AgentRole;
  registeredAt: string;
}

// ── Functions ───────────────────────────────────────────

function settingsKey(taskId: string): string {
  return `agent_role_${taskId}`;
}

/**
 * Register an agent's role for a specific task.
 * Persists in project settings. Returns warning if a different role was already registered.
 */
export function registerAgentRole(
  store: SqliteStore,
  role: AgentRole,
  taskId: string,
): AgentRoleRegistration {
  const key = settingsKey(taskId);
  const now = new Date().toISOString();

  // Check existing registration
  const existing = store.getProjectSetting(key);
  let warning: string | undefined;

  if (existing) {
    try {
      const parsed = JSON.parse(existing) as StoredAgentRole;
      if (parsed.role !== role) {
        warning = `Role already registered for ${taskId}: was '${parsed.role}', overwriting with '${role}'`;
        logger.warn("agent-role:overwrite", { taskId, oldRole: parsed.role, newRole: role });
      }
    } catch (err) {
      logger.debug("intentional-swallow", { error: String(err), reason: "corrupted setting — overwrite silently" });
    }
  }

  const value: StoredAgentRole = { role, registeredAt: now };
  store.setProjectSetting(key, JSON.stringify(value));

  logger.debug("agent-role:register", { role, taskId });

  return { role, taskId, registeredAt: now, warning };
}

/**
 * Get the registered agent role for a task. Returns null if none registered.
 */
export function getAgentRole(store: SqliteStore, taskId: string): StoredAgentRole | null {
  const key = settingsKey(taskId);
  const raw = store.getProjectSetting(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredAgentRole;
  } catch {
    return null;
  }
}
