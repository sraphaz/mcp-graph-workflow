/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { SwarmConfigSchema } from "./swarm-types.js";
import type { SwarmConfigInput, Topology, ConsensusKind } from "./swarm-types.js";

export interface SwarmSession {
  id: string;
  topology: Topology;
  consensus: ConsensusKind;
  status: "pending" | "active" | "stopped";
  maxAgents: number;
  strategy: string;
  createdAt: string;
  updatedAt: string;
}

type SessionRow = {
  id: string;
  topology: string;
  consensus: string;
  status: string;
  max_agents: number;
  strategy: string;
  created_at: string;
  updated_at: string;
};

function toSession(row: SessionRow): SwarmSession {
  return {
    id: row.id,
    topology: row.topology as Topology,
    consensus: row.consensus as ConsensusKind,
    status: row.status as SwarmSession["status"],
    maxAgents: row.max_agents,
    strategy: row.strategy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SwarmCoordinator {
  constructor(private readonly db: Database.Database) {}

  init(input: SwarmConfigInput): SwarmSession {
    const config = SwarmConfigSchema.parse(input);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO swarm_sessions (id, topology, consensus, status, max_agents, strategy, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .run(id, config.topology, config.consensus, config.maxAgents, config.strategy, now, now);

    logger.info("swarm:init", { id, topology: config.topology, consensus: config.consensus });
    return this.status(id);
  }

  start(sessionId: string): SwarmSession {
    const resultValue = this.db
      .prepare("UPDATE swarm_sessions SET status = 'active', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), sessionId);

    if (resultValue.changes === 0) {
      throw new McpGraphError(`Swarm session not found: ${sessionId}`);
    }

    logger.info("swarm:start", { sessionId });
    return this.status(sessionId);
  }

  stop(sessionId: string): SwarmSession {
    const session = this.getRow(sessionId);
    if (!session) {
      throw new McpGraphError(`Swarm session not found: ${sessionId}`);
    }

    this.db.transaction(() => {
      this.db.prepare("DELETE FROM swarm_agents WHERE session_id = ?").run(sessionId);
      this.db
        .prepare("UPDATE swarm_sessions SET status = 'stopped', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), sessionId);
    })();

    logger.info("swarm:stop", { sessionId });
    return this.status(sessionId);
  }

  scale(sessionId: string, newMax: number): SwarmSession {
    if (newMax < 1) {
      throw new McpGraphError(`maxAgents must be >= 1, got ${newMax}`);
    }
    if (newMax > 32) {
      throw new McpGraphError(`maxAgents ceiling is 32, got ${newMax}`);
    }

    const resultValue = this.db
      .prepare("UPDATE swarm_sessions SET max_agents = ?, updated_at = ? WHERE id = ?")
      .run(newMax, new Date().toISOString(), sessionId);

    if (resultValue.changes === 0) {
      throw new McpGraphError(`Swarm session not found: ${sessionId}`);
    }

    logger.info("swarm:scale", { sessionId, newMax });
    return this.status(sessionId);
  }

  status(sessionId: string): SwarmSession {
    const row = this.getRow(sessionId);
    if (!row) {
      throw new McpGraphError(`Swarm session not found: ${sessionId}`);
    }
    return toSession(row);
  }

  private getRow(sessionId: string): SessionRow | undefined {
    return this.db
      .prepare("SELECT * FROM swarm_sessions WHERE id = ?")
      .get(sessionId) as SessionRow | undefined;
  }
}
