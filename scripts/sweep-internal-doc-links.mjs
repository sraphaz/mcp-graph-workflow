#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * T3.5 — Sweep cross-references after the docs reorg that moved 9
 * directories under docs/_internal/. Cross-platform (Node, no shell).
 *
 * Reads every .md / .ts / .tsx / .json / .yml / .yaml file under the
 * repo (skipping node_modules, dist, .git, _internal, hermes-agent*,
 * browser-*, tools/copilot-bridge*, tools/cli/dist) and replaces old
 * docs paths with their new _internal locations.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Order matters: longer/more-specific paths first so e.g.
// "docs/provenance/ots/" doesn't collide with a hypothetical
// "docs/provenance/" rule (none exists today, but defensive).
const REWRITES = [
  ["docs/provenance/ots/", "docs/_internal/provenance-ots/"],
  ["docs/BENCHMARK-v11.md", "docs/_internal/BENCHMARK-v11.md"],
  ["docs/preprint/", "docs/_internal/preprint/"],
  ["docs/migration/", "docs/_internal/migration/"],
  ["docs/authorship/", "docs/_internal/authorship/"],
  ["docs/inpi/", "docs/_internal/inpi/"],
  ["docs/prd/", "docs/_internal/prd/"],
  ["docs/adr/", "docs/_internal/adr/"],
  ["docs/dx/", "docs/_internal/dx/"],
];

const FILE_EXTS = new Set([".md", ".ts", ".tsx", ".json", ".yml", ".yaml"]);
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "_internal", // self-references inside _internal stay relative; sweep is for
  // outside-pointers. Tests over moved files inside _internal
  // are handled directly (validate.ts deprecation, migration-doc test).
  "coverage",
  "hermes-agent-main",
  "browser-use-main",
  "browser-harness-main",
  ".playwright-mcp",
  "presentation",
]);
const SKIP_PATH_PARTS = ["tools/copilot-bridge/node_modules", "tools/copilot-bridge-cli/node_modules", "tools/cli/dist", "src/web/dashboard/node_modules"];

let filesScanned = 0;
let filesChanged = 0;
let totalReplacements = 0;

function shouldSkipPath(rel) {
  for (const part of SKIP_PATH_PARTS) {
    if (rel.includes(part)) return true;
  }
  return false;
}

function walk(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const rel = path.relative(ROOT, full);
    if (shouldSkipPath(rel)) continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full);
    } else if (st.isFile()) {
      const ext = path.extname(entry);
      if (!FILE_EXTS.has(ext)) continue;
      processFile(full, rel);
    }
  }
}

function processFile(full, rel) {
  filesScanned++;
  const original = readFileSync(full, "utf8");
  let updated = original;
  let localReplacements = 0;
  for (const [from, to] of REWRITES) {
    const before = updated;
    updated = updated.split(from).join(to);
    if (updated !== before) {
      const matches = (before.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
      localReplacements += matches;
    }
  }
  if (updated !== original) {
    writeFileSync(full, updated, "utf8");
    filesChanged++;
    totalReplacements += localReplacements;
    console.log(`  ${rel} — ${localReplacements} replacement(s)`);
  }
}

console.log("Sweeping cross-refs to old docs paths → docs/_internal/...");
walk(ROOT);
console.log(`\nDone. Scanned ${filesScanned} file(s); rewrote ${filesChanged} file(s); ${totalReplacements} total replacement(s).`);
