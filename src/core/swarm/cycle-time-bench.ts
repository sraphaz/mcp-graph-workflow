/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies.
 * Cycle-time bench: compares single-agent (sequential) vs hierarchical
 * (parallel queen→workers fan-out) execution. Returns elapsed ms for both
 * paths plus delta percentage. Used to validate AC7 (target -40% on
 * parallelizable tasks).
 */

import { McpGraphError } from "../utils/errors.js";

export interface CycleTimeBenchOptions<T> {
  taskCount: number;
  workers: number;
  taskFn: () => Promise<T>;
}

export interface CycleTimeArm {
  totalMs: number;
  taskCount: number;
}

export interface CycleTimeBenchResult {
  single: CycleTimeArm;
  hierarchical: CycleTimeArm;
  /** (single - hierarchical) / single * 100. Positive = hierarchical faster. */
  deltaPercent: number;
  ranOk: boolean;
}

async function runSequential<T>(taskCount: number, taskFn: () => Promise<T>): Promise<number> {
  const start = performance.now();
  for (let i = 0; i < taskCount; i++) {
    await taskFn();
  }
  return performance.now() - start;
}

async function runParallelByWorkers<T>(
  taskCount: number,
  workers: number,
  taskFn: () => Promise<T>,
): Promise<number> {
  const start = performance.now();
  let dispatched = 0;
  while (dispatched < taskCount) {
    const batchSize = Math.min(workers, taskCount - dispatched);
    const batch: Promise<T>[] = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(taskFn());
    }
    await Promise.all(batch);
    dispatched += batchSize;
  }
  return performance.now() - start;
}

export async function runCycleTimeBench<T>(
  opts: CycleTimeBenchOptions<T>,
): Promise<CycleTimeBenchResult> {
  if (opts.workers < 1) {
    throw new McpGraphError(`workers must be >= 1, got ${opts.workers}`);
  }
  if (opts.taskCount === 0) {
    return {
      single: { totalMs: 0, taskCount: 0 },
      hierarchical: { totalMs: 0, taskCount: 0 },
      deltaPercent: 0,
      ranOk: true,
    };
  }

  let ranOk = true;
  let singleMs = 0;
  let hierarchicalMs = 0;
  try {
    singleMs = await runSequential(opts.taskCount, opts.taskFn);
    hierarchicalMs = await runParallelByWorkers(opts.taskCount, opts.workers, opts.taskFn);
  } catch {
    ranOk = false;
  }

  const deltaPercent = singleMs > 0 ? ((singleMs - hierarchicalMs) / singleMs) * 100 : 0;
  return {
    single: { totalMs: singleMs, taskCount: opts.taskCount },
    hierarchical: { totalMs: hierarchicalMs, taskCount: opts.taskCount },
    deltaPercent,
    ranOk,
  };
}
