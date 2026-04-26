/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkObservability } from "../core/analyzer/observability-checker.js";

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "obs-check-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf-8");
  }
  return root;
}

describe("checkObservability", () => {
  it("passes a project with full logger coverage and no console.log", () => {
    const root = makeProject({
      "src/core/foo.ts": "import { logger } from './log.js';\nexport function f() { logger.info('x', {}); }\n",
      "src/core/bar.ts": "import { logger } from './log.js';\nexport function g() { logger.warn('y', {}); }\n",
    });
    const r = checkObservability(root);
    expect(r.mode).toBe("observability_check");
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.checks.find((c) => c.name === "logger_coverage")?.passed).toBe(true);
    expect(r.checks.find((c) => c.name === "structured_logging")?.passed).toBe(true);
  });

  it("flags files using console.log as structured_logging failure", () => {
    const root = makeProject({
      "src/core/dirty.ts": "export function f() { console.log('hi'); }\n",
    });
    const r = checkObservability(root);
    expect(r.checks.find((c) => c.name === "structured_logging")?.passed).toBe(false);
    expect(r.findings.some((f) => f.rule === "no-console")).toBe(true);
  });

  it("flags files exporting symbols without using logger as gaps", () => {
    const root = makeProject({
      "src/core/silent.ts": "export function noLog() { return 1; }\n",
    });
    const r = checkObservability(root);
    expect(r.gaps).toContain("src/core/silent.ts");
  });

  it("rewards catch blocks that log via logger.error/warn", () => {
    const root = makeProject({
      "src/core/risky.ts":
        "import { logger } from './log.js';\nexport function f() {\n  try { dangerous(); } catch (err) { logger.error('boom', { err }); }\n}\n",
    });
    const r = checkObservability(root);
    expect(r.checks.find((c) => c.name === "error_handling")?.passed).toBe(true);
  });

  it("returns score in [0, 100] and matches grade", () => {
    const root = makeProject({
      "src/core/a.ts": "import { logger } from './log.js';\nexport function f() { logger.info('a', {}); }\n",
    });
    const r = checkObservability(root);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(typeof r.grade).toBe("string");
    expect(r.grade.length).toBeGreaterThan(0);
  });

  it("does not crash on a project with no source files at all", () => {
    const root = makeProject({});
    const r = checkObservability(root);
    expect(r.mode).toBe("observability_check");
    // No files = no failures. Required check defaults to passed.
    expect(r.passed).toBe(true);
  });

  it("ignores .test.ts and .spec.ts files for logger coverage", () => {
    const root = makeProject({
      "src/core/real.ts":
        "import { logger } from './log.js';\nexport function f() { logger.info('x', {}); }\n",
      "src/core/real.test.ts": "console.log('test setup');\n", // would fail if scanned
    });
    const r = checkObservability(root);
    expect(r.checks.find((c) => c.name === "structured_logging")?.passed).toBe(true);
  });

  it("excludes node_modules, dist, .git and similar directories", () => {
    const root = makeProject({
      "src/core/clean.ts": "import { logger } from './log.js';\nexport function f() { logger.info('x', {}); }\n",
      "node_modules/lib/dirty.ts": "console.log('library code');\n",
      "dist/output.ts": "console.log('build output');\n",
    });
    const r = checkObservability(root);
    // The console.log files are inside excluded dirs → must NOT be flagged.
    expect(r.checks.find((c) => c.name === "structured_logging")?.passed).toBe(true);
  });
});
