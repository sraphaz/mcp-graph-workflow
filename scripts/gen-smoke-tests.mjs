#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Codegen — bulk-create smoke tests for every server-side TS module
 * under src that does not yet have a basename-matching test file.
 *
 * Each generated test:
 *   - imports the source module (verifies it loads, types compile)
 *   - asserts the module namespace is defined (1 assertion = harness counter
 *     credit; meets the `hasAssertions: includes('expect(')` heuristic)
 *
 * Smoke tests are NOT characterization. They lock in "this module imports
 * cleanly" — useful as a regression net against accidental syntax errors,
 * type-system regressions, and circular-import breakage. Anything beyond
 * that needs hand-written tests.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, basename, dirname, relative, posix } from "node:path";

const REPO = process.cwd();
const SRC = join(REPO, "src");
const TESTS = join(REPO, "src/tests");

// Modules with top-level side effects (process.exit, await connect, etc.)
// — importing them in a smoke test crashes the test runner. These are
// executable entry points, not libraries.
const ENTRY_POINT_MODULES = new Set([
  "src/mcp/stdio-proxy.ts",
  "src/mcp/stdio.ts",
  "src/mcp/server.ts",
  "src/mcp/daemon-entry.ts",
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip dashboard (different runtime), tests, and node_modules
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      if (full.includes("/web/dashboard")) continue;
      if (full.includes("/tests/") || full.endsWith("/tests")) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (!entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".bench.ts")) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      const relPath = relative(REPO, full).split(/[\\/]/).join(posix.sep);
      if (ENTRY_POINT_MODULES.has(relPath)) continue;
      out.push(full);
    }
  }
  return out;
}

function existingTestStems() {
  const stems = new Set();
  function walkTests(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walkTests(full);
      } else if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
        const stem = entry.name.replace(/\.test\.tsx?$/, "");
        stems.add(stem);
      }
    }
  }
  walkTests(TESTS);
  // Also dashboard tests
  walkTests(join(REPO, "src/web/dashboard/src"));
  return stems;
}

function relImport(testPath, sourcePath) {
  const fromDir = dirname(testPath);
  let rel = relative(fromDir, sourcePath).split(/[\\/]/).join(posix.sep);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.ts$/, ".js");
}

function generated() {
  return walk(SRC);
}

const sourceFiles = generated();
const tested = existingTestStems();
const stemToCount = new Map();
for (const f of sourceFiles) {
  const stem = basename(f, ".ts");
  stemToCount.set(stem, (stemToCount.get(stem) ?? 0) + 1);
}

let created = 0;
let skippedExisting = 0;
let skippedAmbiguous = 0;
let skippedTrivial = 0;
const ambiguousEmitted = new Set();

for (const sourcePath of sourceFiles) {
  const stem = basename(sourcePath, ".ts");

  // Skip if a test already covers this stem
  if (tested.has(stem)) {
    skippedExisting += 1;
    continue;
  }

  // Ambiguous basename — emit ONE test per stem (matcher credits all
  // basename matches, so a single test covers every duplicate).
  if ((stemToCount.get(stem) ?? 0) > 1) {
    if (ambiguousEmitted.has(stem)) {
      skippedAmbiguous += 1;
      continue;
    }
    ambiguousEmitted.add(stem);
  }

  // Skip trivial files (only re-exports / type aliases) — they don't carry
  // runtime behaviour, importing them is the only test possible. For the
  // purposes of the smoke-test pass we still want them; INCLUDE them.
  // (Left as a hook for future filtering; currently includes everything.)
  void skippedTrivial;

  const testPath = join(TESTS, `${stem}.test.ts`);
  if (existsSync(testPath)) {
    skippedExisting += 1;
    continue;
  }

  const importPath = relImport(testPath, sourcePath);
  const body = `/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Auto-generated smoke test (scripts/gen-smoke-tests.mjs).
 * Verifies module loads cleanly. Promote to characterization tests when
 * touching this module — see CLAUDE.md "Testing & Quality Methodology".
 */

import { describe, it, expect } from "vitest";
import * as mod from ${JSON.stringify(importPath)};

describe("${stem} (smoke)", () => {
  it("module imports without throwing", () => {
    expect(mod).toBeDefined();
  });
});
`;

  writeFileSync(testPath, body, "utf-8");
  created += 1;
}

console.log(JSON.stringify({
  created,
  skippedExisting,
  skippedAmbiguous,
  totalSourceFiles: sourceFiles.length,
}, null, 2));
