/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22 — Autonomy bootstrap.
 * Single entry point that constructs and starts the autonomy stack
 * (RetryWorker + AutopilotScheduler + EventReactor) and returns a stop()
 * for graceful shutdown. Pure wiring — daemon-entry calls bootstrapAutonomy
 * during startup and stop() during signal handling.
 */

import type Database from "better-sqlite3";

import { RetryWorker, type RetryExecutor } from "./retry-worker.js";
import {
  AutopilotScheduler,
  isAutopilotPaused,
  DEFAULT_TICK_MS,
  type Dispatcher,
} from "./autopilot-scheduler.js";
import { EventReactor, type ReactorBus } from "./event-reactor.js";

export interface AutonomyBootstrapOptions {
  db: Database.Database;
  /** Bus that supports both on() and emit() — passed to EventReactor. */
  bus: ReactorBus;
  /** Executor invoked by RetryWorker for each pending retry. */
  retryExecutor: RetryExecutor;
  /** Dispatcher invoked by AutopilotScheduler for each ready node. */
  dispatcher: Dispatcher;
  /** Optional emit-fn so RetryWorker can publish events directly (not via bus). */
  emitEvent?: (event: string, payload: Record<string, unknown>) => void;
  /** Override the scheduler tick (default 5min). */
  schedulerTickMs?: number;
  /** Override the retry-worker poll interval. */
  retryIntervalMs?: number;
  /** Env (default process.env) — used to honor MCP_GRAPH_AUTOPILOT_PAUSED. */
  env?: NodeJS.ProcessEnv;
}

export interface AutonomyHandle {
  retryWorker: RetryWorker;
  scheduler: AutopilotScheduler;
  reactor: EventReactor;
  stop: () => void;
  /** True after start(); false after stop(). */
  isRunning: () => boolean;
}

/**
 * Construct + start the autonomy stack.
 *
 * Order:
 *   1. RetryWorker.start() — picks up persisted retries from previous runs.
 *   2. EventReactor.register() — handlers hot before scheduler ticks.
 *   3. AutopilotScheduler.start() — only if env doesn't have it paused.
 *
 * Stop reverses the order so events keep flowing during scheduler shutdown.
 * The bus subscriptions registered by EventReactor stay live (the bus owns
 * its lifetime); intentionally no unsubscribe API today.
 */
export function bootstrapAutonomy(opts: AutonomyBootstrapOptions): AutonomyHandle {
  const env = opts.env ?? process.env;

  const retryWorker = new RetryWorker(opts.db, opts.retryExecutor, {
    emitEvent: opts.emitEvent,
  });
  const reactor = new EventReactor(opts.db, opts.bus);
  const scheduler = new AutopilotScheduler(opts.db, opts.dispatcher);

  let running = false;

  retryWorker.start(opts.retryIntervalMs);
  reactor.register();
  if (!isAutopilotPaused(env)) {
    scheduler.start(opts.schedulerTickMs ?? DEFAULT_TICK_MS);
  }
  running = true;

  const stop = (): void => {
    if (!running) return;
    scheduler.stop();
    retryWorker.stop();
    running = false;
  };

  return { retryWorker, scheduler, reactor, stop, isRunning: () => running };
}
