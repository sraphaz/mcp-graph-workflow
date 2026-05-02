#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Bug-hunt validator — fail CI if any node under the v13.3.x bug-hunt
 * notebook (mcp-graph epic node_4e5847d6d9ac) carries a banned hand-wave
 * phrase in its description. Mirrors the runtime guardrail
 * (src/core/hooks/anti-hallucination-detector.ts) at the planning layer.
 *
 * Usage:
 *   node scripts/bug-hunt-validator.mjs            # exit 1 on any violation
 *   node scripts/bug-hunt-validator.mjs --list     # only print findings, exit 0
 *
 * Reads the active project DB at workflow-graph/graph.db. Skips silently
 * when the DB is missing — that case is covered by the runtime hook.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const BANNED_PHRASES = [
  "standard practice",
  "typically",
  "obviously",
  "normally",
  "as expected",
  "best practice",
  "common pattern",
  "generally",
];

const HUNT_EPIC_ID = "node_4e5847d6d9ac";

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const matchers = BANNED_PHRASES.map((p) => ({
  phrase: p,
  re: new RegExp(`\\b${escapeRegex(p)}\\b`, "i"),
}));

function detect(text) {
  if (!text) return [];
  return matchers.filter((m) => m.re.test(text)).map((m) => m.phrase);
}

const dbPath = join(process.cwd(), "workflow-graph/graph.db");
if (!existsSync(dbPath)) {
  process.stderr.write(`[bug-hunt-validator] no graph.db at ${dbPath}; skipping\n`);
  process.exit(0);
}

let Database;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  process.stderr.write("[bug-hunt-validator] better-sqlite3 not installed; run npm ci\n");
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });

let nodes;
try {
  nodes = db
    .prepare(
      `WITH RECURSIVE descendants(id) AS (
         SELECT id FROM nodes WHERE id = ?
         UNION ALL
         SELECT n.id FROM nodes n JOIN descendants d ON n.parent_id = d.id
       )
       SELECT id, type, title, description FROM nodes
       WHERE id IN (SELECT id FROM descendants)`,
    )
    .all(HUNT_EPIC_ID);
} catch (err) {
  process.stderr.write(`[bug-hunt-validator] query failed: ${err.message}\n`);
  process.exit(0);
}

const listOnly = process.argv.includes("--list");
let violations = 0;

for (const n of nodes) {
  const fields = [
    { name: "title", value: n.title },
    { name: "description", value: n.description },
  ];
  for (const f of fields) {
    const hits = detect(f.value);
    if (hits.length === 0) continue;
    violations += 1;
    process.stderr.write(
      `[bug-hunt-validator] ${n.id} ${n.type} ${f.name} contains banned phrase(s): ${hits.join(", ")}\n`,
    );
    process.stderr.write(`  title: ${n.title ?? "(empty)"}\n`);
  }
}

if (violations > 0 && !listOnly) {
  process.stderr.write(`\n[bug-hunt-validator] ${violations} violation(s) — see .claude/rules/anti-hallucination.md\n`);
  process.exit(1);
}

process.stderr.write(`[bug-hunt-validator] scanned ${nodes.length} nodes; ${violations} violation(s)\n`);
process.exit(0);
