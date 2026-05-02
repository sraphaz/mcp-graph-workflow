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

import { SqliteStore } from "../core/store/sqlite-store.js";
import { logger } from "../core/utils/logger.js";

/**
 * Open a SqliteStore for a CLI command, presenting a friendly error and
 * exiting non-zero if the database file is corrupt. Without this wrapper,
 * `SqliteStore.open()` propagates the raw better-sqlite3 SqliteError with
 * its full stack trace and node_modules paths to end users (B11 in the
 * v13.3.1 bug-hunt notebook, node_57264fd72793).
 */
export function openStoreOrFail(dir: string): SqliteStore {
  try {
    return SqliteStore.open(dir);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e?.code === "SQLITE_NOTADB" || e?.code === "SQLITE_CORRUPT") {
      logger.error(`Database corrupt at ${dir}/workflow-graph/graph.db: ${e.message ?? "unknown sqlite error"}`);
      logger.error(`Fix: rm -rf ${dir}/workflow-graph && mcp-graph init`);
      process.exit(1);
    }
    throw err;
  }
}
