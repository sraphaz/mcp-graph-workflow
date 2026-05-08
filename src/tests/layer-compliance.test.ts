/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Story 2 — Layer tagging compliance gate.
 *
 * Every production TS file in src/api/, src/mcp/tools/, and src/core/rag/
 * must use createLogger({ layer, source }) instead of calling the raw
 * logger singleton directly. This test enforces that invariant by
 * statically scanning for non-compliant call sites.
 *
 * WHY static scan rather than runtime: the invariant is structural —
 * we want every module to bind layer+source at the point it logs, not
 * require 100% code-path coverage to detect a missing tag.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function collectTs(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectTs(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts") && !entry.endsWith(".d.ts") && entry !== "logger.ts" && entry !== "add-logging.ts") {
      results.push(full);
    }
  }
  return results;
}

/** Direct singleton method calls that bypass layer tagging. */
const SINGLETON_CALL_RE = /\blogger\s*\.\s*(info|warn|error|debug|success)\s*\(/;

interface Violation {
  file: string;
  lines: number[];
}

function scanLayer(layerDir: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of collectTs(layerDir)) {
    const src = readFileSync(file, "utf-8");
    const lines = src.split("\n");

    // Skip files that already fully use createLogger (no singleton calls expected)
    if (!SINGLETON_CALL_RE.test(src)) continue;

    // If the file has singleton calls AND uses createLogger, it's a mixed state —
    // still flag because every call must go through the contextual logger.
    const badLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (SINGLETON_CALL_RE.test(lines[i])) {
        badLines.push(i + 1);
      }
    }
    if (badLines.length > 0) {
      violations.push({ file: relative(ROOT, file), lines: badLines });
    }
  }
  return violations;
}

const LAYERS: Array<{ name: string; dir: string }> = [
  { name: "src/api/**", dir: join(ROOT, "src/api") },
  { name: "src/mcp/tools/**", dir: join(ROOT, "src/mcp/tools") },
  { name: "src/core/rag/**", dir: join(ROOT, "src/core/rag") },
  { name: "src/core/** (excl. rag)", dir: join(ROOT, "src/core") },
  { name: "src/cli/**", dir: join(ROOT, "src/cli") },
];

describe("Story 2 — layer tagging compliance", () => {
  for (const { name, dir } of LAYERS) {
    it(`${name} uses createLogger, no direct singleton calls`, () => {
      const violations = scanLayer(dir);
      const report = violations
        .map((v) => `  ${v.file}: lines ${v.lines.join(", ")}`)
        .join("\n");
      expect(violations, `Non-compliant files:\n${report}`).toHaveLength(0);
    });
  }
});
