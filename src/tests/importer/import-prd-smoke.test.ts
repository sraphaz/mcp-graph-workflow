/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task: Smoke test de import_prd contra PRD externo no CI
 * AC1 — GIVEN 3 PRDs externos no fixture WHEN CI roda THEN import_prd produz nodes sem erros não documentados
 * AC2 — GIVEN import_prd com regressão em PRD externo WHEN CI executa THEN build falha com mensagem apontando a fixture
 * AC3 — GIVEN evolução intencional do parser WHEN behavior muda THEN fixture atualizada no mesmo PR com diff revisado
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../fixtures/external-prd");

function loadFixture(filename: string): string {
  return readFileSync(join(FIXTURES_DIR, filename), "utf-8");
}

const FIXTURES = [
  { name: "spec-kit-english.md", style: "Spec-Kit English" },
  { name: "corporate-portuguese.md", style: "Corporate Portuguese" },
  { name: "minimal-markdown.md", style: "Minimal Markdown" },
];

describe("AC1 — import_prd produces nodes without undocumented errors", () => {
  for (const fixture of FIXTURES) {
    it(`should parse ${fixture.style} fixture without throwing`, () => {
      const text = loadFixture(fixture.name);
      expect(() => extractEntities(text)).not.toThrow();
    });

    it(`should extract at least one classified block from ${fixture.style} fixture`, () => {
      const text = loadFixture(fixture.name);
      const result = extractEntities(text);
      expect(result.blocks.length).toBeGreaterThan(0);
    });

    it(`should produce at least one graph node from ${fixture.style} fixture`, () => {
      const text = loadFixture(fixture.name);
      const extraction = extractEntities(text);
      const graph = convertToGraph(extraction, fixture.name);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  }
});

describe("AC2 — regression detection: parser output is stable for known fixtures", () => {
  it("should extract epics or tasks from spec-kit-english.md (regression gate)", () => {
    const text = loadFixture("spec-kit-english.md");
    const result = extractEntities(text);
    const epicOrTask = result.blocks.filter((b) => b.type === "epic" || b.type === "task");
    expect(epicOrTask.length).toBeGreaterThan(0);
  });

  it("should extract epics or tasks from corporate-portuguese.md (regression gate)", () => {
    const text = loadFixture("corporate-portuguese.md");
    const result = extractEntities(text);
    const epicOrTask = result.blocks.filter((b) => b.type === "epic" || b.type === "task");
    expect(epicOrTask.length).toBeGreaterThan(0);
  });

  it("should extract tasks or requirements from minimal-markdown.md (regression gate)", () => {
    const text = loadFixture("minimal-markdown.md");
    const result = extractEntities(text);
    const structured = result.blocks.filter((b) =>
      ["epic", "task", "subtask", "requirement"].includes(b.type),
    );
    expect(structured.length).toBeGreaterThan(0);
  });

  it("should record fixture name in diagnostic output when graph node count is 0", () => {
    // This verifies that the fixture-name is always in scope for debugging
    for (const fixture of FIXTURES) {
      const text = loadFixture(fixture.name);
      const extraction = extractEntities(text);
      const graph = convertToGraph(extraction, fixture.name);
      if (graph.nodes.length === 0) {
        throw new Error(
          `[import-prd-smoke] Fixture '${fixture.name}' produced 0 nodes — ` +
            `parser may have regressed. Update fixture or fix parser.`,
        );
      }
    }
  });
});

describe("AC3 — fixture-driven workflow: external format coverage", () => {
  it("should have all 3 required fixture files present", () => {
    for (const fixture of FIXTURES) {
      expect(() => loadFixture(fixture.name)).not.toThrow();
    }
  });

  it("should handle fixtures with no mcp-graph keywords gracefully", () => {
    // External PRDs don't use mcp-graph lifecycle keywords — should not crash
    const text = loadFixture("spec-kit-english.md");
    expect(text).not.toMatch(/import_prd|mcp-graph|update_status/);
    expect(() => extractEntities(text)).not.toThrow();
  });

  it("should report summary totals for each fixture (enables diff on intentional change)", () => {
    for (const fixture of FIXTURES) {
      const text = loadFixture(fixture.name);
      const result = extractEntities(text);
      expect(typeof result.summary.totalSections).toBe("number");
      // Summary fields must always be present — if a field disappears, this test catches the regression
      expect(result.summary).toHaveProperty("epics");
      expect(result.summary).toHaveProperty("tasks");
      expect(result.summary).toHaveProperty("requirements");
    }
  });
});
