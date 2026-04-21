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

import { existsSync } from "node:fs";
import path from "node:path";
import { SqliteStore } from "../store/sqlite-store.js";
import { STORE_DIR, DB_FILE } from "../utils/constants.js";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { CheckResult, DoctorReport } from "./doctor-types.js";
import {
  checkNodeVersion,
  checkWritePermissions,
  checkSqliteDatabase,
  checkDbIntegrity,
  checkGraphInitialized,
  checkConfigFile,
  checkDashboardBuild,
  checkMcpJson,
  checkIntegrations,
  checkOnnxStatus,
} from "./doctor-checks.js";

function buildSummary(checks: CheckResult[]): DoctorReport["summary"] {
  let ok = 0;
  let warning = 0;
  let error = 0;
  for (const c of checks) {
    if (c.level === "ok") ok++;
    else if (c.level === "warning") warning++;
    else error++;
  }
  return { ok, warning, error };
}

/**
 * Run all doctor checks and return a structured report.
 */
export async function runDoctor(basePath: string): Promise<DoctorReport> {
  if (!basePath) {
    throw new McpGraphError("Doctor requires a valid base path");
  }
  logger.info("Running doctor checks", { basePath });

  const checks: CheckResult[] = [];

  // 1. Sync checks
  checks.push(checkNodeVersion());
  checks.push(checkConfigFile(basePath));
  checks.push(checkMcpJson(basePath));

  // 2. Async checks (parallel where possible)
  const [writeResult, sqliteResult, dbIntegrityResult, dashboardResult, integrationResults, onnxResult] =
    await Promise.all([
      checkWritePermissions(basePath),
      checkSqliteDatabase(basePath),
      checkDbIntegrity(basePath),
      checkDashboardBuild(basePath),
      checkIntegrations(basePath),
      checkOnnxStatus(),
    ]);

  checks.push(writeResult);
  checks.push(sqliteResult);
  checks.push(dbIntegrityResult);
  checks.push(dashboardResult);
  checks.push(...integrationResults);
  checks.push(onnxResult);

  // 3. Store-dependent checks (only if DB exists)
  const dbPath = path.join(basePath, STORE_DIR, DB_FILE);
  if (existsSync(dbPath)) {
    try {
      const store = SqliteStore.open(basePath);
      try {
        checks.push(checkGraphInitialized(store));
      } finally {
        store.close();
      }
    } catch (err) {
      checks.push({
        name: "graph-initialized",
        level: "warning",
        message: `Could not open store: ${err instanceof Error ? err.message : String(err)}`,
        suggestion: "Run 'mcp-graph init' to initialize the project",
      });
    }
  }

  const summary = buildSummary(checks);

  return {
    checks,
    summary,
    passed: summary.error === 0,
  };
}
