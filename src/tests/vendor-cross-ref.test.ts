/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-vendor-insights-scanner — Task 1.3: cross-reference keyword matrix
 *
 * AC1: GIVEN keyword `context` + hermes-agent-main/agent/context_compressor.py THEN count > 5
 * AC2: GIVEN keyword `cdp` + browser-harness-main/admin.py THEN count > 0
 * AC3: GIVEN keyword absent in file THEN count = 0 (not omitted)
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildCrossRef,
  queryKeyword,
  MPCGRAPH_KEYWORDS,
  type KeywordHit,
} from "../core/vendor-scan/cross-ref.js";

const VENDOR_DIR = path.resolve(__dirname, "../../vendor");

// ── Unit: buildCrossRef with synthetic input ───────────────────────────────

describe("buildCrossRef — unit", () => {
  it("returns count > 0 for keyword present in content", () => {
    const matrix = buildCrossRef(
      [{ filePath: "foo.py", content: "context context context context context context" }],
      ["context"],
    );
    expect(matrix["foo.py"]!["context"]).toBeGreaterThan(5);
  });

  it("AC3: returns count = 0 for keyword absent — does not omit the entry", () => {
    const matrix = buildCrossRef(
      [{ filePath: "foo.py", content: "no matching words here" }],
      ["rag"],
    );
    expect(matrix["foo.py"]).toBeDefined();
    expect(matrix["foo.py"]!["rag"]).toBe(0);
  });

  it("counts case-insensitively", () => {
    const matrix = buildCrossRef(
      [{ filePath: "a.ts", content: "CDPClient cdpClient CDP_endpoint" }],
      ["cdp"],
    );
    expect(matrix["a.ts"]!["cdp"]).toBeGreaterThanOrEqual(3);
  });

  it("handles multiple files with independent counts", () => {
    const matrix = buildCrossRef(
      [
        { filePath: "a.py", content: "rag rag rag" },
        { filePath: "b.py", content: "memory" },
      ],
      ["rag", "memory"],
    );
    expect(matrix["a.py"]!["rag"]).toBe(3);
    expect(matrix["a.py"]!["memory"]).toBe(0);
    expect(matrix["b.py"]!["rag"]).toBe(0);
    expect(matrix["b.py"]!["memory"]).toBe(1);
  });

  it("all keywords are present for every file (no omissions)", () => {
    const keywords = ["context", "rag", "cdp"];
    const matrix = buildCrossRef(
      [{ filePath: "x.py", content: "context" }],
      keywords,
    );
    for (const kw of keywords) {
      expect(Object.prototype.hasOwnProperty.call(matrix["x.py"], kw)).toBe(true);
    }
  });
});

// ── queryKeyword helper ────────────────────────────────────────────────────

describe("queryKeyword", () => {
  it("returns matching file entries for a given keyword", () => {
    const matrix = buildCrossRef(
      [
        { filePath: "a.py", content: "cdp cdp" },
        { filePath: "b.py", content: "no match" },
      ],
      ["cdp"],
    );
    const hits = queryKeyword(matrix, "cdp");
    expect(hits.some((h: KeywordHit) => h.filePath === "a.py" && h.count > 0)).toBe(true);
  });

  it("omits files with count = 0 from query results", () => {
    const matrix = buildCrossRef(
      [
        { filePath: "a.py", content: "cdp" },
        { filePath: "b.py", content: "nothing" },
      ],
      ["cdp"],
    );
    const hits = queryKeyword(matrix, "cdp");
    expect(hits.every((h: KeywordHit) => h.count > 0)).toBe(true);
  });
});

// ── MPCGRAPH_KEYWORDS list ─────────────────────────────────────────────────

describe("MPCGRAPH_KEYWORDS", () => {
  it("contains the canonical set of keywords", () => {
    const required = ["context", "memory", "rag", "telemetry", "lifecycle", "cdp"];
    for (const kw of required) {
      expect(MPCGRAPH_KEYWORDS).toContain(kw);
    }
  });
});

// ── Integration: real vendor files ────────────────────────────────────────

describe("buildCrossRef — integration with real vendor files", () => {
  it("AC1: context_compressor.py has context count > 5", () => {
    const filePath = path.join(
      VENDOR_DIR,
      "hermes-agent-main/agent/context_compressor.py",
    );
    const content = fs.readFileSync(filePath, "utf-8");
    const matrix = buildCrossRef([{ filePath, content }], ["context"]);
    expect(matrix[filePath]!["context"]).toBeGreaterThan(5);
  });

  it("AC2: browser-harness-main/admin.py has cdp count > 0", () => {
    const filePath = path.join(
      VENDOR_DIR,
      "browser-harness-main/admin.py",
    );
    const content = fs.readFileSync(filePath, "utf-8");
    const matrix = buildCrossRef([{ filePath, content }], ["cdp"]);
    expect(matrix[filePath]!["cdp"]).toBeGreaterThan(0);
  });
});
