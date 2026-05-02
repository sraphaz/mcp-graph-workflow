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
 * SqliteEventBridge — cross-terminal event propagation via SQLite polling.
 *
 * Bridges the in-memory GraphEventBus across terminals by persisting events
 * to `event_queue` table and polling for events from other agents.
 */

import type Database from "better-sqlite3";
import type { GraphEventBus } from "./event-bus.js";
import type { GraphEvent, GraphEventType } from "./event-types.js";
import { logger } from "../utils/logger.js";

interface EventQueueRow {
  id: number;
  event_type: string;
  payload: string;
  agent_id: string;
  created_at: string;
}

export class SqliteEventBridge {
  private lastSeenId: number = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly localBus: GraphEventBus,
    private readonly agentId: string,
  ) {}

  /**
   * Publish an event to the shared queue.
   */
  publish(event: GraphEvent): void {
    this.db
      .prepare(
        "INSERT INTO event_queue (event_type, payload, agent_id, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(
        event.type,
        JSON.stringify(event.payload),
        this.agentId,
        event.timestamp,
      );

    logger.debug("event-bridge:publish", { type: event.type, agentId: this.agentId });
  }

  /**
   * Start polling for events from other agents.
   */
  startPolling(intervalMs: number = 2000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.pollOnce();
      } catch (err) {
        logger.warn("event-bridge:poll_error", { error: String(err) });
      }
    }, intervalMs);
    logger.info("event-bridge:polling_started", { intervalMs, agentId: this.agentId });
  }

  /**
   * Stop polling.
   */
  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.debug("event-bridge:polling_stopped", { agentId: this.agentId });
    }
  }

  /**
   * Poll once — fetch events with id > lastSeenId from other agents
   * and re-emit them on the local bus.
   */
  pollOnce(): void {
    const rows = this.db
      .prepare(
        "SELECT * FROM event_queue WHERE id > ? AND agent_id != ? ORDER BY id ASC",
      )
      .all(this.lastSeenId, this.agentId) as EventQueueRow[];

    for (const row of rows) {
      const event: GraphEvent = {
        type: row.event_type as GraphEventType,
        timestamp: row.created_at,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
      };

      this.localBus.emit(event);
      this.lastSeenId = row.id;

      logger.debug("event-bridge:received", { type: event.type, from: row.agent_id, id: row.id });
    }
  }

  /**
   * Remove events older than maxAgeMs. Returns count of pruned events.
   */
  pruneOld(maxAgeMs: number = 3_600_000): number {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    const resultValue = this.db
      .prepare("DELETE FROM event_queue WHERE created_at < ?")
      .run(cutoff);

    if (resultValue.changes > 0) {
      logger.debug("event-bridge:pruned", { count: resultValue.changes });
    }

    return resultValue.changes;
  }
}
