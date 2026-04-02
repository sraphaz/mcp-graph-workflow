import { describe, it, expect } from "vitest";
import { segment } from "../../core/parser/segment.js";
import { extractTableSections } from "../../core/parser/segment.js";
import type { Section } from "../../core/parser/segment.js";

describe("extractTableSections", () => {
  it("should extract a markdown table as a separate section", () => {
    const sections: Section[] = [
      {
        level: 2,
        title: "Riscos do Projeto",
        body: "Texto introdutório\n\n| Risco | Impacto |\n| --- | --- |\n| Atraso | Alto |\n| Bug | Médio |\n\nTexto final",
        startLine: 1,
        endLine: 10,
      },
    ];

    const result = extractTableSections(sections);

    // Original section should have table lines removed
    const original = result.find((s) => s.title === "Riscos do Projeto");
    expect(original).toBeDefined();
    expect(original!.body).not.toContain("| --- |");
    expect(original!.body).toContain("Texto introdutório");
    expect(original!.body).toContain("Texto final");

    // Table should be extracted as separate section
    const table = result.find((s) => s.title === "[table]");
    expect(table).toBeDefined();
    expect(table!.level).toBe(0);
    expect(table!.body).toContain("| Risco | Impacto |");
    expect(table!.body).toContain("| Atraso | Alto |");
  });

  it("should return unchanged when no tables present", () => {
    const sections: Section[] = [
      {
        level: 2,
        title: "Simple Section",
        body: "Just plain text\nNo tables here",
        startLine: 1,
        endLine: 3,
      },
    ];

    const result = extractTableSections(sections);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Simple Section");
    expect(result[0].body).toBe("Just plain text\nNo tables here");
  });

  it("should handle section with only a table", () => {
    const sections: Section[] = [
      {
        level: 3,
        title: "Tabela",
        body: "| Col1 | Col2 |\n| --- | --- |\n| A | B |",
        startLine: 5,
        endLine: 8,
      },
    ];

    const result = extractTableSections(sections);

    // The table is extracted
    const table = result.find((s) => s.title === "[table]");
    expect(table).toBeDefined();
    expect(table!.body).toContain("| Col1 | Col2 |");
  });

  it("should extract multiple tables from one section", () => {
    const sections: Section[] = [
      {
        level: 2,
        title: "Multi Tables",
        body: "Intro\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nMiddle text\n\n| C | D |\n| --- | --- |\n| 3 | 4 |",
        startLine: 1,
        endLine: 12,
      },
    ];

    const result = extractTableSections(sections);
    const tables = result.filter((s) => s.title === "[table]");
    expect(tables).toHaveLength(2);
  });
});

describe("segment + extractTableSections integration", () => {
  it("should work together on markdown with headings and tables", () => {
    const markdown = `## Overview

Some intro text

## Risks

| Risk | Impact |
| --- | --- |
| Delay | High |

## Tasks

- Implement feature A
- Test feature A`;

    const sections = segment(markdown);
    const expanded = extractTableSections(sections);

    // Should have the original sections plus extracted table
    const tableSection = expanded.find((s) => s.title === "[table]");
    expect(tableSection).toBeDefined();

    const risksSection = expanded.find((s) => s.title === "Risks");
    expect(risksSection).toBeDefined();
    expect(risksSection!.body).not.toContain("| --- |");
  });
});
