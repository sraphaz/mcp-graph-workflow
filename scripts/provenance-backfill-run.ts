/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * scripts/provenance-backfill-run.ts — apply provenance backfill to the
 * project's local graph DB. Reads MCP_GRAPH_DB_PATH or defaults to
 * `workflow-graph/graph.db`. Run via `npm run harness:provenance:backfill`.
 */

import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { applyProvenanceBackfill } from "../src/core/harness/provenance-backfill-store.js";

function main(): void {
  const dbPath = resolve(process.env.MCP_GRAPH_DB_PATH ?? "workflow-graph/graph.db");
  if (!existsSync(dbPath)) {
    process.stderr.write(`[provenance:backfill] no DB at ${dbPath}\n`);
    process.exit(1);
  }

  const db = new Database(dbPath);
  try {
    const before = (db.prepare(
      "SELECT COUNT(*) AS cnt FROM nodes WHERE source_file IS NOT NULL AND source_file != ''",
    ).get() as { cnt: number }).cnt;
    const total = (db.prepare("SELECT COUNT(*) AS cnt FROM nodes").get() as { cnt: number }).cnt;
    const summary = applyProvenanceBackfill(db);
    const after = (db.prepare(
      "SELECT COUNT(*) AS cnt FROM nodes WHERE source_file IS NOT NULL AND source_file != ''",
    ).get() as { cnt: number }).cnt;

    process.stdout.write(
      JSON.stringify(
        {
          dbPath,
          totalNodes: total,
          receiptBefore: before,
          receiptAfter: after,
          scanned: summary.scanned,
          updated: summary.updated,
          provenanceBefore: total === 0 ? 100 : Math.round((before / total) * 100),
          provenanceAfter: total === 0 ? 100 : Math.round((after / total) * 100),
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    db.close();
  }
}

main();
