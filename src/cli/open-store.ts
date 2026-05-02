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
import { join } from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { logger } from "../core/utils/logger.js";

export interface OpenStoreOptions {
  /**
   * When true, fail before SqliteStore.open() touches the filesystem if
   * `<dir>/workflow-graph/graph.db` does not exist. Use for read-only CLI
   * commands (stats, list, doctor) so they do not silently materialize an
   * empty workflow-graph/ directory in the user's cwd. B15 in the v13.3.1
   * bug-hunt notebook (node_1cfe2d825862).
   */
  requireExisting?: boolean;
}

/**
 * Open a SqliteStore for a CLI command, presenting a friendly error and
 * exiting non-zero if the database file is corrupt or (when
 * `requireExisting`) absent. Without this wrapper, `SqliteStore.open()`
 * either dumps the raw better-sqlite3 SqliteError stack trace (B11,
 * node_57264fd72793) or silently auto-creates a fresh workflow-graph/
 * directory at any cwd (B15, node_1cfe2d825862).
 */
export function openStoreOrFail(dir: string, opts: OpenStoreOptions = {}): SqliteStore {
  if (opts.requireExisting === true) {
    const dbPath = join(dir, "workflow-graph", "graph.db");
    if (!existsSync(dbPath)) {
      logger.error(`No mcp-graph project at ${dir}. Run 'mcp-graph init' to create one.`);
      process.exit(1);
    }
  }
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
