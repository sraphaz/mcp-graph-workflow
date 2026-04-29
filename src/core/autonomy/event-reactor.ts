/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.A4 — EventReactor.
 * Subscribes a 5 eventos críticos no shared bus e dispara ações estruturadas:
 *   - cost:budget_exceeded   → pause autopilot via env var
 *   - error:retry_exhausted  → emit approval:required (nodeId + reason)
 *   - session:start          → resume snapshot if recent (< 24h)
 *   - task:error             → enqueue retry_queue (RetryWorker pega)
 *   - harness:regression     → pause autopilot quando delta <= -10
 */

import type Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import { enqueueRetry } from "./retry-worker.js";

export const EVENT_HANDLERS = [
  "cost:budget_exceeded",
  "error:retry_exhausted",
  "session:start",
  "task:error",
  "harness:regression",
] as const;

const HARNESS_REGRESSION_THRESHOLD = -10;

export interface ReactorBus {
  on(event: string, handler: (payload: unknown) => void | Promise<void>): void;
  emit(event: string, payload: unknown): Promise<void> | void;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export class EventReactor {
  constructor(
    private readonly db: Database.Database,
    private readonly bus: ReactorBus,
  ) {}

  register(): void {
    this.bus.on("cost:budget_exceeded", async (payload) => {
      try {
        process.env.MCP_GRAPH_AUTOPILOT_PAUSED = "true";
        logger.warn("event-reactor:cost:budget_exceeded", {
          payload: isObject(payload) ? payload : null,
        });
      } catch (err) {
        logger.error("event-reactor:cost:budget_exceeded:error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.bus.on("error:retry_exhausted", async (payload) => {
      try {
        const taskId = isObject(payload) && typeof payload["taskId"] === "string"
          ? payload["taskId"]
          : null;
        const lastError = isObject(payload) && typeof payload["lastError"] === "string"
          ? payload["lastError"]
          : "retry exhausted";
        logger.warn("event-reactor:error:retry_exhausted", { taskId, lastError });
        await this.bus.emit("approval:required", {
          nodeId: taskId,
          reason: `retry exhausted: ${lastError}`,
          severity: "high",
          source: "event-reactor",
        });
      } catch (err) {
        logger.error("event-reactor:error:retry_exhausted:error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.bus.on("session:start", async () => {
      try {
        // Read last_session_ts from project_settings (best-effort).
        const row = this.db
          .prepare(`SELECT value FROM project_settings WHERE key = 'autopilot.last_session_ts'`)
          .get() as { value: string } | undefined;
        if (!row) {
          logger.debug("event-reactor:session:start:no-prior-snapshot");
          return;
        }
        const lastTs = Number.parseInt(row.value, 10);
        if (!Number.isFinite(lastTs)) return;
        const ageMs = Date.now() - lastTs;
        const TWENTY_FOUR_H = 24 * 60 * 60 * 1000;
        if (ageMs > TWENTY_FOUR_H) {
          logger.info("event-reactor:session:start:snapshot-stale", { ageMs });
          return;
        }
        logger.info("event-reactor:session:start:resume", { ageMs });
      } catch (err) {
        logger.error("event-reactor:session:start:error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.bus.on("task:error", async (payload) => {
      try {
        const nodeId = isObject(payload) && typeof payload["nodeId"] === "string"
          ? payload["nodeId"]
          : null;
        if (!nodeId) {
          logger.debug("event-reactor:task:error:no-node-id");
          return;
        }
        const errorMsg = isObject(payload) && typeof payload["error"] === "string"
          ? payload["error"]
          : undefined;
        const retryId = enqueueRetry(this.db, nodeId, errorMsg);
        logger.info("event-reactor:task:error:enqueued", { nodeId, retryId });
      } catch (err) {
        logger.error("event-reactor:task:error:error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.bus.on("harness:regression", async (payload) => {
      try {
        const delta = isObject(payload) && typeof payload["delta"] === "number"
          ? payload["delta"]
          : 0;
        if (delta <= HARNESS_REGRESSION_THRESHOLD) {
          process.env.MCP_GRAPH_AUTOPILOT_PAUSED = "true";
          logger.warn("event-reactor:harness:regression:pause", { delta });
        } else {
          logger.debug("event-reactor:harness:regression:within-threshold", { delta });
        }
      } catch (err) {
        logger.error("event-reactor:harness:regression:error", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    logger.info("event-reactor:registered", {
      events: EVENT_HANDLERS.length,
      list: EVENT_HANDLERS,
    });
  }
}
