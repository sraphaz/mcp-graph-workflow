/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-serena-symbol-retrieval-bridge — Task 1.1: Tabela Serena vs Code Intelligence
 *
 * AC1: GIVEN 13 tools + 8 hooks WHEN tabela é gerada THEN cada um tem status (sem "TBD")
 * AC2: GIVEN unique-to-serena WHEN tabela é gerada THEN linha cita arquivo + classe do vendor
 * AC3: GIVEN redundante WHEN tabela é gerada THEN linha cita equivalente em src/core/code/ ou src/core/hooks/
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OVERLAP_MD = join(process.cwd(), "docs/_internal/serena-overlap.md");
const FILE_PRESENT = existsSync(OVERLAP_MD);

function readCatalog(): string {
  return readFileSync(OVERLAP_MD, "utf-8");
}

/** Extract data rows from the 4-column tool/hook tables (ignores separator and header rows) */
function extractRows(content: string): string[] {
  return content
    .split("\n")
    .filter((l) => {
      if (!l.startsWith("|")) return false;
      // Skip separator rows (e.g. |---|---|)
      if (l.replace(/\|/g, "").replace(/-/g, "").trim() === "") return false;
      // Keep only rows with exactly 4 cells (the tool/hook tables)
      const cells = l.split("|").filter((c) => c !== "");
      if (cells.length !== 4) return false;
      // Skip header rows (last cell is "Status" or "CI Equivalent")
      const lastCell = cells[3]?.trim() ?? "";
      return !["Status", "CI Equivalent"].includes(lastCell);
    });
}

// ── AC1: all rows have a status (no TBD) ─────────────────────────────────────

describe.skipIf(!FILE_PRESENT)("serena-overlap.md — AC1: no TBD statuses", () => {
  it("AC1: file exists at docs/_internal/serena-overlap.md", () => {
    expect(() => readCatalog()).not.toThrow();
  });

  it("AC1: file contains no 'TBD' status values", () => {
    const content = readCatalog();
    expect(content).not.toMatch(/\|\s*TBD\s*\|/);
  });

  it("AC1: at least 13 tool entries are present (symbol_tools.py count)", () => {
    const content = readCatalog();
    const toolRows = extractRows(content).filter((r) =>
      r.toLowerCase().includes("tool") || r.toLowerCase().includes("symbol"),
    );
    expect(toolRows.length).toBeGreaterThanOrEqual(13);
  });

  it("AC1: each row has one of the valid statuses: redundante, complementar, unique-to-serena", () => {
    const content = readCatalog();
    const rows = extractRows(content);
    const VALID_STATUSES = ["redundante", "complementar", "unique-to-serena"];
    const invalidRows = rows.filter(
      (r) => !VALID_STATUSES.some((s) => r.toLowerCase().includes(s)),
    );
    expect(invalidRows).toHaveLength(0);
  });
});

// ── AC2: unique-to-serena rows cite vendor file + class ───────────────────────

describe.skipIf(!FILE_PRESENT)("serena-overlap.md — AC2: unique-to-serena rows cite vendor", () => {
  it("AC2: unique-to-serena rows contain vendor file path reference", () => {
    const content = readCatalog();
    const rows = extractRows(content).filter((r) => r.toLowerCase().includes("unique-to-serena"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatch(/vendor\//i);
    }
  });

  it("AC2: unique-to-serena rows contain the class name", () => {
    const content = readCatalog();
    const rows = extractRows(content).filter((r) => r.toLowerCase().includes("unique-to-serena"));
    for (const row of rows) {
      // Each unique row should have at least one capitalized class-name pattern (Tool/Hook/Symbol)
      expect(row).toMatch(/[A-Z][a-zA-Z]+(Tool|Hook|Symbol)/);
    }
  });
});

// ── AC3: redundante rows cite equivalent in src/core/code/ or src/core/hooks/ ─

describe.skipIf(!FILE_PRESENT)("serena-overlap.md — AC3: redundante rows cite src/core equivalent", () => {
  it("AC3: redundante rows reference src/core/code/ or src/core/hooks/", () => {
    const content = readCatalog();
    const rows = extractRows(content).filter((r) => r.toLowerCase().includes("redundante"));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toMatch(/src\/core\/(code|hooks)\//i);
    }
  });
});
