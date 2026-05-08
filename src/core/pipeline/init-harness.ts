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
 * Harness baseline for project initialization.
 * Runs a non-blocking harness scan to establish initial baseline.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { runHarnessScan } from "../harness/harness-scan-runner.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "init-harness.ts" });

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
    log.info("pipeline:init_harness:ok", { score: scan.score, grade: scan.grade });
  } catch (err) {
    log.debug("pipeline:init_harness:scan_skipped", { error: String(err) });
  }

  return {
    harnessBaseline,
    harnessHint: "Run analyze(mode: 'harness_scan') periodically to track agent readiness. Use help(topic: 'harness') for full reference.",
  };
}
