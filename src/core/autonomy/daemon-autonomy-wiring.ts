/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22 — Daemon-side autonomy wiring helper.
 * Bridges daemon-entry to bootstrapAutonomy. Gated behind
 * MCP_GRAPH_AUTONOMY=on so the production daemon stays unchanged unless the
 * operator opts in. This module:
 *
 *   1. Adapts the GraphEventBus (any-event with payload) to the ReactorBus
 *      interface (string-key on/emit) the EventReactor expects.
 *   2. Provides safe default executors that no-op + log so a misconfigured
 *      daemon never crashes during retry tick or scheduler dispatch.
 *
 * Real production wiring replaces the default executors with calls into
 * pipeline.startTask / runWithDeterministicRetry; that integration lives in
 * the daemon CLI, not here, to keep this module side-effect free.
 */

import type Database from "better-sqlite3";

import { logger } from "../utils/logger.js";
import {
  bootstrapAutonomy,
  type AutonomyHandle,
} from "./autonomy-bootstrap.js";
import type { Dispatcher } from "./autopilot-scheduler.js";
import type { RetryExecutor } from "./retry-worker.js";
import type { ReactorBus } from "./event-reactor.js";

export interface AnyEventBus {
  on(event: string, handler: (payload: unknown) => void | Promise<void>): unknown;
  emit(event: string, payload?: unknown): unknown;
}

export interface DaemonAutonomyOptions {
  db: Database.Database;
  bus: AnyEventBus;
  retryExecutor?: RetryExecutor;
  dispatcher?: Dispatcher;
  emitEvent?: (event: string, payload: Record<string, unknown>) => void;
  schedulerTickMs?: number;
  retryIntervalMs?: number;
  env?: NodeJS.ProcessEnv;
}

export function isAutonomyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MCP_GRAPH_AUTONOMY === "on";
}

/**
 * Adapt an AnyEventBus into a ReactorBus. The shim ensures emit() always
 * returns a Promise so EventReactor's `await this.bus.emit(...)` chain stays
 * stable regardless of the underlying bus implementation.
 */
export function toReactorBus(bus: AnyEventBus): ReactorBus {
  return {
    on(event, handler) {
      bus.on(event, handler);
    },
    async emit(event, payload) {
      try {
        await Promise.resolve(bus.emit(event, payload));
      } catch (err) {
        logger.error("daemon-autonomy:bus-emit-error", {
          event,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  };
}

const noopRetry: RetryExecutor = async (taskId) => {
  logger.warn("daemon-autonomy:noop-retry-executor", { taskId });
};

const noopDispatch: Dispatcher = async (nodeId) => {
  logger.warn("daemon-autonomy:noop-dispatcher", { nodeId });
};

/**
 * Boot the autonomy stack from a daemon. Returns undefined when
 * MCP_GRAPH_AUTONOMY is not "on" — the daemon stays unchanged in that
 * case, which is the production default.
 */
export function maybeStartDaemonAutonomy(
  opts: DaemonAutonomyOptions,
): AutonomyHandle | undefined {
  const env = opts.env ?? process.env;
  if (!isAutonomyEnabled(env)) {
    logger.info("daemon-autonomy:skipped", { reason: "MCP_GRAPH_AUTONOMY!=on" });
    return undefined;
  }

  logger.info("daemon-autonomy:starting", {
    schedulerTickMs: opts.schedulerTickMs,
    retryIntervalMs: opts.retryIntervalMs,
  });

  return bootstrapAutonomy({
    db: opts.db,
    bus: toReactorBus(opts.bus),
    retryExecutor: opts.retryExecutor ?? noopRetry,
    dispatcher: opts.dispatcher ?? noopDispatch,
    emitEvent: opts.emitEvent,
    schedulerTickMs: opts.schedulerTickMs,
    retryIntervalMs: opts.retryIntervalMs,
    env,
  });
}
