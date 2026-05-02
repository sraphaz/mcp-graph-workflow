/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A3 — AutopilotScheduler.
 * Cron-style background loop que dispara start_task pipeline a cada
 * AUTOPILOT_TICK_MS quando autopilot mode está ativo. Picker:
 * status=ready AND blocked=0 ORDER BY priority ASC, created_at ASC LIMIT 1.
 * Pause via env MCP_GRAPH_AUTOPILOT_PAUSED=true (definido pelo EventReactor
 * em cost:budget_exceeded ou harness:regression).
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";

export const DEFAULT_TICK_MS = 5 * 60 * 1000; // 5 min

export type Dispatcher = (nodeId: string) => Promise<void>;

export interface ReadyNode {
  id: string;
  title: string;
  priority: number;
}

/** isAutopilotPaused — auto-generated description placeholder. */
export function isAutopilotPaused(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_AUTOPILOT_PAUSED === "true";
}

interface NodeRow {
  id: string;
  title: string;
  priority: number;
}

/** pickNextReadyNode — auto-generated description placeholder. */
export function pickNextReadyNode(db: Database.Database): ReadyNode | null {
  const row = db
    .prepare(
      `SELECT id, title, priority
       FROM nodes
       WHERE status = 'ready' AND COALESCE(blocked, 0) = 0
       ORDER BY priority ASC, created_at ASC
       LIMIT 1`,
    )
    .get() as NodeRow | undefined;
  if (!row) return null;
  return { id: row.id, title: row.title, priority: row.priority };
}

export class AutopilotScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: Database.Database,
    private readonly dispatcher: Dispatcher,
  ) {}

  start(intervalMs: number = DEFAULT_TICK_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick().catch((err) => {
        logger.error("autopilot-scheduler:tick-error", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, intervalMs);
    if (typeof this.timer.unref === "function") this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    if (isAutopilotPaused()) {
      logger.debug("autopilot-scheduler:paused");
      return;
    }

    const node = pickNextReadyNode(this.db);
    if (!node) {
      logger.debug("autopilot-scheduler:no-ready-node");
      return;
    }

    logger.info("autopilot-scheduler:dispatch", {
      nodeId: node.id,
      title: node.title,
      priority: node.priority,
    });

    try {
      await this.dispatcher(node.id);
    } catch (err) {
      logger.error("autopilot-scheduler:dispatch-failed", {
        nodeId: node.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
