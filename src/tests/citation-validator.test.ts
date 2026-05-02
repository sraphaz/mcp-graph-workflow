/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Characterization tests for citation-validator — locks the contract that
 * `src/core/` files must carry §EPIC / §ADR citations and other paths are
 * exempt.
 */

import { describe, it, expect } from "vitest";
import { isCorePath, validateFilesCitations } from "../core/citations/citation-validator.js";

describe("isCorePath", () => {
  it.each([
    ["src/core/foo.ts", true],
    ["./src/core/foo.ts", true],
    ["a/b/src/core/x.ts", true],
    ["src/cli/index.ts", false],
    ["src/tests/foo.test.ts", false],
    ["src/web/dashboard/main.tsx", false],
    ["src/coreless/x.ts", false],
    ["docs/foo.md", false],
    ["", false],
  ])("path %s → %s", (path, expected) => {
    expect(isCorePath(path)).toBe(expected);
  });
});

describe("validateFilesCitations", () => {
  it("flags core files lacking citations", () => {
    const files = [
      { path: "src/core/foo.ts", content: "no citation here" },
    ];
    const result = validateFilesCitations(files);
    expect(result.checkedCount).toBe(1);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].path).toBe("src/core/foo.ts");
    expect(result.violations[0].reason).toMatch(/§EPIC|§ADR/);
  });

  it("ignores non-core files even without citation", () => {
    const files = [
      { path: "src/cli/foo.ts", content: "no citation" },
      { path: "src/tests/x.test.ts", content: "no citation" },
    ];
    const result = validateFilesCitations(files);
    expect(result.checkedCount).toBe(0);
    expect(result.violations).toHaveLength(0);
  });

  it("accepts core files that carry §EPIC citation", () => {
    const files = [
      { path: "src/core/x.ts", content: "// §EPIC-13 implementation" },
    ];
    const result = validateFilesCitations(files);
    expect(result.checkedCount).toBe(1);
    expect(result.violations).toHaveLength(0);
  });

  it("accepts core files that carry §ADR citation", () => {
    const files = [
      { path: "src/core/x.ts", content: "// §ADR-0042 — design rationale" },
    ];
    const result = validateFilesCitations(files);
    expect(result.violations).toHaveLength(0);
  });

  it("returns 0/0 for empty input", () => {
    expect(validateFilesCitations([])).toEqual({ violations: [], checkedCount: 0 });
  });

  it("counts checked separately from violations", () => {
    const files = [
      { path: "src/core/a.ts", content: "// §EPIC-1" },
      { path: "src/core/b.ts", content: "no cite" },
      { path: "src/core/c.ts", content: "no cite" },
      { path: "src/cli/d.ts", content: "no cite" },
    ];
    const result = validateFilesCitations(files);
    expect(result.checkedCount).toBe(3); // a, b, c
    expect(result.violations).toHaveLength(2); // b, c
  });

  it("violation paths are returned verbatim", () => {
    const files = [{ path: "src/core/some-deep/path.ts", content: "x" }];
    const result = validateFilesCitations(files);
    expect(result.violations[0].path).toBe("src/core/some-deep/path.ts");
  });
});
