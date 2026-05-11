/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux — Task 0.5 (archive) → Task 2.2 (post-deletion gate).
 *
 * Pre-deletion: asserted importers matched the documented set (delta = 0).
 * Post-deletion (Task 2.2 complete): asserts zero importers remain anywhere
 * in src/ outside of test files. The "all documented points exist" check
 * is retired since those files were deleted by Task 2.2.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "../../..");

function collectFeatureDepthImporters(): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist"].includes(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        const rel = path.relative(SRC_ROOT, fullPath);
        if (rel.startsWith("src/tests/")) continue;

        const content = fs.readFileSync(fullPath, "utf8");
        const hasImport = content
          .split("\n")
          .some((line) => {
            const t = line.trimStart();
            if (t.startsWith("//") || t.startsWith("*")) return false;
            return /\bimport\b.*feature-depth|await import\(.*feature-depth/.test(line);
          });

        if (hasImport) {
          results.push(rel);
        }
      }
    }
  }

  walk(SRC_ROOT);
  return results.sort();
}

describe("feature-depth coupling audit (post-deletion)", () => {
  let actualImporters: string[];

  beforeAll(() => {
    actualImporters = collectFeatureDepthImporters();
  });

  it("returns a finite list of feature-depth importers", () => {
    expect(Array.isArray(actualImporters)).toBe(true);
  });

  it("zero feature-depth import statements remain in src/ (post-deletion gate)", () => {
    if (actualImporters.length > 0) {
      console.warn("[feature-depth-coupling] Remaining importers after deletion:", actualImporters);
    }
    expect(actualImporters).toEqual([]);
  });
});

