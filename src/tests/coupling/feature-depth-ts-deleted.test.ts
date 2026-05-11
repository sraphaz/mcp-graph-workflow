/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux — Task 2.2: src/core/feature-depth TS modules deleted.
 *
 * AC2: zero feature-depth import statements remain in src/
 * AC3: src/core/feature-depth/ directory absent
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../..");

function findFeatureDepthImports(): string[] {
  const hits: string[] = [];
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const rel = path.relative(SRC, full);
        if (rel.startsWith("src/tests/")) continue;
        const content = fs.readFileSync(full, "utf8");
        const hasImport = content.split("\n").some((line) => {
          const t = line.trimStart();
          if (t.startsWith("//") || t.startsWith("*")) return false;
          return /\bimport\b.*feature-depth|await import\(.*feature-depth/.test(line);
        });
        if (hasImport) hits.push(rel);
      }
    }
  }
  walk(path.join(SRC, "src"));
  return hits.sort();
}

describe("Task 2.2: feature-depth TS modules deleted", () => {
  it("src/core/feature-depth/ directory no longer exists", () => {
    expect(fs.existsSync(path.join(SRC, "src/core/feature-depth"))).toBe(false);
  });

  it("src/mcp/tools/feature-depth.ts no longer exists", () => {
    expect(fs.existsSync(path.join(SRC, "src/mcp/tools/feature-depth.ts"))).toBe(false);
  });

  it("zero feature-depth import statements remain in src/ (non-test files)", () => {
    const remaining = findFeatureDepthImports();
    if (remaining.length > 0) {
      console.error("Remaining feature-depth importers:", remaining);
    }
    expect(remaining).toHaveLength(0);
  });
});
