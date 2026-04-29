/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  extractCitations,
  hasCitation,
} from "../core/citations/citation-extractor.js";
import {
  validateFilesCitations,
  isCorePath,
} from "../core/citations/citation-validator.js";

describe("extractCitations", () => {
  it("extracts §EPIC-7.3 style references from a comment", () => {
    expect(extractCitations("// implements §EPIC-7.3 (cleanup)")).toEqual(["§EPIC-7.3"]);
  });

  it("extracts multiple citations from a multi-line block", () => {
    const code = `
      /* §ADR-0049 */
      // also: §EPIC-13.1 §EPIC-13.2
    `;
    expect(extractCitations(code).sort()).toEqual(["§ADR-0049", "§EPIC-13.1", "§EPIC-13.2"]);
  });

  it("returns empty array when no citation present", () => {
    expect(extractCitations("plain code without references")).toEqual([]);
  });

  it("does not match a bare § without identifier", () => {
    expect(extractCitations("§ alone")).toEqual([]);
  });

  it("hasCitation returns true/false correctly", () => {
    expect(hasCitation("// §EPIC-3.1 done")).toBe(true);
    expect(hasCitation("// nothing")).toBe(false);
  });
});

describe("isCorePath", () => {
  it("flags src/core/* paths as core", () => {
    expect(isCorePath("src/core/citations/extractor.ts")).toBe(true);
    expect(isCorePath("src/core/store/sqlite-store.ts")).toBe(true);
  });

  it("non-core paths are not flagged", () => {
    expect(isCorePath("src/cli/index.ts")).toBe(false);
    expect(isCorePath("src/tests/foo.test.ts")).toBe(false);
    expect(isCorePath("docs/x.md")).toBe(false);
  });
});

describe("validateFilesCitations", () => {
  it("returns no violations when every core file has at least one citation", () => {
    const result = validateFilesCitations([
      { path: "src/core/foo.ts", content: "// §EPIC-1.1 ok" },
      { path: "src/core/bar.ts", content: "/* §ADR-0042 */" },
    ]);
    expect(result.violations).toEqual([]);
    expect(result.checkedCount).toBe(2);
  });

  it("flags core files missing citations", () => {
    const result = validateFilesCitations([
      { path: "src/core/foo.ts", content: "no reference here" },
      { path: "src/core/bar.ts", content: "// §EPIC-1.1 ok" },
    ]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.path).toBe("src/core/foo.ts");
    expect(result.violations[0]?.reason).toMatch(/citation/i);
  });

  it("ignores non-core paths", () => {
    const result = validateFilesCitations([
      { path: "src/cli/index.ts", content: "no ref" },
      { path: "src/tests/x.test.ts", content: "no ref" },
    ]);
    expect(result.violations).toEqual([]);
    expect(result.checkedCount).toBe(0);
  });
});
