/**
 * Harness baseline for project initialization.
 * Runs a non-blocking harness scan to establish initial baseline.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { runHarnessScan } from "../harness/harness-scan-runner.js";
import { logger } from "../utils/logger.js";

export interface HarnessBaseline {
  score: number;
  grade: string;
}

export interface InitHarnessResult {
  harnessBaseline: HarnessBaseline | null;
  harnessHint: string;
}

/**
 * Run initial harness scan for a newly initialized project.
 * Non-blocking: returns null baseline on any error.
 */
export function initWithHarnessBaseline(store: SqliteStore): InitHarnessResult {
  let harnessBaseline: HarnessBaseline | null = null;

  try {
    const scan = runHarnessScan(process.cwd(), store.getDb());
    harnessBaseline = { score: scan.score, grade: scan.grade };
    logger.info("pipeline:init_harness:ok", { score: scan.score, grade: scan.grade });
  } catch (err) {
    logger.debug("pipeline:init_harness:scan_skipped", { error: String(err) });
  }

  return {
    harnessBaseline,
    harnessHint: "Run analyze(mode: 'harness_scan') periodically to track agent readiness. Use help(topic: 'harness') for full reference.",
  };
}
