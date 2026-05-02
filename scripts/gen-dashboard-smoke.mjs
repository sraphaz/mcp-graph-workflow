#!/usr/bin/env node
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Codegen — colocated smoke tests for dashboard modules under
 * src/web/dashboard/src/. Mirrors gen-smoke-tests.mjs but stays inside
 * the dashboard's vitest project (jsdom env).
 */

import { writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename, dirname, relative, posix } from "node:path";

const REPO = process.cwd();
const DASH = join(REPO, "src/web/dashboard/src");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, out);
    } else if (entry.isFile()) {
      if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) continue;
      if (entry.name.endsWith(".d.ts")) continue;
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      // Skip entry points / test setup
      if (["main.tsx", "vite-env.d.ts", "test-setup.ts"].includes(entry.name)) continue;
      out.push(full);
    }
  }
  return out;
}

function existingStems() {
  const stems = new Set();
  function walkTests(dir) {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) walkTests(full);
      else if (e.name.endsWith(".test.ts") || e.name.endsWith(".test.tsx")) {
        stems.add(e.name.replace(/\.test\.tsx?$/, ""));
      }
    }
  }
  walkTests(join(REPO, "src/tests"));
  walkTests(DASH);
  return stems;
}

function relImport(testPath, sourcePath) {
  const fromDir = dirname(testPath);
  let rel = relative(fromDir, sourcePath).split(/[\\/]/).join(posix.sep);
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.tsx$/, "").replace(/\.ts$/, "");
}

const sourceFiles = walk(DASH);
const tested = existingStems();
const stemToCount = new Map();
for (const f of sourceFiles) {
  const stem = basename(f).replace(/\.(ts|tsx)$/, "");
  stemToCount.set(stem, (stemToCount.get(stem) ?? 0) + 1);
}

let created = 0;
let skippedExisting = 0;
const ambiguousEmitted = new Set();

for (const sourcePath of sourceFiles) {
  const ext = sourcePath.endsWith(".tsx") ? "tsx" : "ts";
  const stem = basename(sourcePath).replace(/\.(ts|tsx)$/, "");

  if (tested.has(stem)) {
    skippedExisting += 1;
    continue;
  }
  if ((stemToCount.get(stem) ?? 0) > 1) {
    if (ambiguousEmitted.has(stem)) {
      skippedExisting += 1;
      continue;
    }
    ambiguousEmitted.add(stem);
  }

  // Colocate test next to source so it joins the dashboard project
  const dir = dirname(sourcePath);
  const testPath = join(dir, `${stem}.test.${ext === "tsx" ? "tsx" : "ts"}`);
  if (existsSync(testPath)) {
    skippedExisting += 1;
    continue;
  }

  const importPath = relImport(testPath, sourcePath);
  const body = `/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Auto-generated smoke test (scripts/gen-dashboard-smoke.mjs).
 * Verifies the dashboard module loads cleanly in jsdom env.
 * Promote to characterization tests when touching this module.
 */

import { describe, it, expect } from "vitest";
import * as mod from ${JSON.stringify(importPath)};

describe("${stem} (dashboard smoke)", () => {
  it("module imports without throwing", () => {
    expect(mod).toBeDefined();
  });
});
`;

  writeFileSync(testPath, body, "utf-8");
  created += 1;
  tested.add(stem);
}

console.log(JSON.stringify({ created, skippedExisting, totalDashboardFiles: sourceFiles.length }, null, 2));
