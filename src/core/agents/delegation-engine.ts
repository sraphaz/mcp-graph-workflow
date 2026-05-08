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
 * Delegation Engine — creates isolated sub-agent scopes with restricted toolsets.
 * Constraints: maxDepth=2, maxConcurrent=3 (configurable).
 * Delegation is logical (unified-gate filtering), not process isolation.
 * Inspired by hermes-agent delegation tool.
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { createLogger } from "../utils/logger.js";
import { McpGraphError } from "../utils/errors.js";
import type { DelegationTask } from "../../schemas/delegation.schema.js";

const log = createLogger({ layer: "core", source: "delegation-engine.ts" });

export const MAX_DEPTH = 2;
export const MAX_CONCURRENT = 3;

export interface DelegationRecord {
  id: string;
  parentAgentId: string;
  childAgentId: string;
  objective: string;
  allowedTools: string[];
  status: "running" | "completed" | "failed" | "timeout";
  resultSummary: string | null;
  tokensUsed: number;
  depth: number;
  createdAt: string;
  completedAt: string | null;
}

interface DelegationRow {
  id: string;
  parent_agent_id: string;
  child_agent_id: string;
  objective: string;
  allowed_tools: string;
  status: string;
  result_summary: string | null;
  tokens_used: number;
  depth: number;
  created_at: string;
  completed_at: string | null;
}

function rowToRecord(row: DelegationRow): DelegationRecord {
  return {
    id: row.id,
    parentAgentId: row.parent_agent_id,
    childAgentId: row.child_agent_id,
    objective: row.objective,
    allowedTools: JSON.parse(row.allowed_tools) as string[],
    status: row.status as DelegationRecord["status"],
    resultSummary: row.result_summary,
    tokensUsed: row.tokens_used,
    depth: row.depth,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export class DelegationEngine {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Create a new delegation. Enforces maxDepth and maxConcurrent.
   * Returns the delegation ID.
   */
  create(parentAgentId: string, task: DelegationTask, depth: number = 1): string {
    // Enforce depth limit
    if (depth > MAX_DEPTH) {
      throw new McpGraphError(`Max delegation depth exceeded: ${depth} > ${MAX_DEPTH}`);
    }

    // Enforce concurrent limit
    const activeCount = this.getActiveCount();
    if (activeCount >= MAX_CONCURRENT) {
      throw new McpGraphError(`Max concurrent delegations exceeded: ${activeCount} >= ${MAX_CONCURRENT}`);
    }

    const id = generateId("deleg");
    const childAgentId = generateId("agent");
    const allowedToolsJson = JSON.stringify(task.allowedTools);

    this.db.prepare(
      `INSERT INTO delegations (id, parent_agent_id, child_agent_id, objective, allowed_tools, status, depth, created_at)
       VALUES (?, ?, ?, ?, ?, 'running', ?, ?)`,
    ).run(id, parentAgentId, childAgentId, task.objective, allowedToolsJson, depth, now());

    log.info("delegation:created", { id, parentAgentId, childAgentId, depth, tools: task.allowedTools.length });
    return id;
  }

  complete(delegationId: string, summary: string, tokensUsed: number = 0): void {
    this.db.prepare(
      `UPDATE delegations SET status = 'completed', result_summary = ?, tokens_used = ?, completed_at = ?
       WHERE id = ?`,
    ).run(summary, tokensUsed, now(), delegationId);
    log.info("delegation:completed", { id: delegationId });
  }

  fail(delegationId: string, errorMessage: string): void {
    this.db.prepare(
      `UPDATE delegations SET status = 'failed', result_summary = ?, completed_at = ?
       WHERE id = ?`,
    ).run(errorMessage, now(), delegationId);
    log.warn("delegation:failed", { id: delegationId, error: errorMessage });
  }

  getById(id: string): DelegationRecord | null {
    const row = this.db.prepare(
      "SELECT * FROM delegations WHERE id = ?",
    ).get(id) as DelegationRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  getActiveForParent(parentAgentId: string): DelegationRecord[] {
    const rows = this.db.prepare(
      "SELECT * FROM delegations WHERE parent_agent_id = ? AND status = 'running' ORDER BY created_at ASC",
    ).all(parentAgentId) as DelegationRow[];
    return rows.map(rowToRecord);
  }

  getActiveCount(): number {
    const row = this.db.prepare(
      "SELECT COUNT(*) as count FROM delegations WHERE status = 'running'",
    ).get() as { count: number };
    return row.count;
  }
}
