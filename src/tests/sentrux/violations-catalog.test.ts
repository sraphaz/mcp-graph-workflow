/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 0.4 — Catalogar violações sem corrigir
 *
 * AC1: GIVEN rules.toml + scan WHEN rodo check THEN lista estruturada
 * AC2: GIVEN catálogo WHEN inspeciono THEN cada entrada tem path + regra + severidade
 * AC3: GIVEN catálogo WHEN reviso THEN cada item tem owner-PRD OU "accepted out of scope"
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const catalogPath = path.resolve("docs/_internal/audit/sentrux-baseline-violations.md");
const catalogContent = fs.existsSync(catalogPath) ? fs.readFileSync(catalogPath, "utf8") : "";

// ---------------------------------------------------------------------------
// AC1: catalog file exists and has structured violation sections
// ---------------------------------------------------------------------------

describe("sentrux-baseline-violations.md — AC1: structured catalog", () => {
  it("should exist at docs/_internal/audit/sentrux-baseline-violations.md", () => {
    expect(fs.existsSync(catalogPath)).toBe(true);
  });

  it("should not be empty", () => {
    expect(catalogContent.length).toBeGreaterThan(0);
  });

  it("should contain a violations section or 'no violations' marker", () => {
    expect(catalogContent).toMatch(/violation|No violations|0 violations/i);
  });

  it("should reference the rules that were scanned", () => {
    expect(catalogContent).toMatch(/core-no-cli|provider-sdk-confinement/);
  });
});

// ---------------------------------------------------------------------------
// AC2: each violation entry has path + rule + severity
// ---------------------------------------------------------------------------

describe("sentrux-baseline-violations.md — AC2: entry structure", () => {
  it("should document the scan date", () => {
    expect(catalogContent).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("should reference severity levels", () => {
    expect(catalogContent).toMatch(/error|warning|severity/i);
  });

  it("should reference file paths (src/ entries) or state no violations found", () => {
    const hasPaths = /src\//.test(catalogContent);
    const hasNoViolations = /No violations|0 violations|nenhuma violação/i.test(catalogContent);
    expect(hasPaths || hasNoViolations).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: each item has owner-PRD candidate or "accepted out of scope"
// ---------------------------------------------------------------------------

describe("sentrux-baseline-violations.md — AC3: disposition for each item", () => {
  it("should contain owner-PRD or accepted-out-of-scope dispositions", () => {
    expect(catalogContent).toMatch(/owner-prd|out.of.scope|accepted|owner PRD/i);
  });

  it("should contain a summary or totals section", () => {
    expect(catalogContent).toMatch(/total|summary|Total/i);
  });
});
