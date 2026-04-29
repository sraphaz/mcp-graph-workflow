/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import type { ExtractionResult } from "../core/parser/extract.js";
import type { ClassifiedBlock } from "../core/parser/classify.js";

function block(
  title: string,
  type: ClassifiedBlock["type"],
  level = 2,
  confidence = 0.7,
): ClassifiedBlock {
  return {
    type,
    title,
    description: "",
    items: [],
    startLine: 1,
    endLine: 2,
    confidence,
    level,
  };
}

describe("prd-to-graph: structural heading marker", () => {
  it("marks TIER X — heading nodes with metadata.implementable=false", () => {
    const extraction: ExtractionResult = {
      summary: { totalSections: 0, epics: 0, tasks: 0, subtasks: 0, requirements: 0, constraints: 0, acceptanceCriteria: 0, risks: 0, unknown: 0 },
      blocks: [
        block("TIER A — Alto valor (7 itens)", "task", 3),
        block("Implementar autenticação OAuth", "task", 3),
      ],
    };
    const { nodes } = convertToGraph(extraction, "test.md");

    const tierNode = nodes.find((n) => n.title.startsWith("TIER A"));
    const implNode = nodes.find((n) => n.title.startsWith("Implementar"));

    expect(tierNode?.metadata?.implementable).toBe(false);
    expect(implNode?.metadata?.implementable).toBeUndefined();
  });

  it("marks Sequenciamento and Princípio orientador as structural", () => {
    const extraction: ExtractionResult = {
      summary: { totalSections: 0, epics: 0, tasks: 0, subtasks: 0, requirements: 0, constraints: 0, acceptanceCriteria: 0, risks: 0, unknown: 0 },
      blocks: [
        block("Sequenciamento (4 sprints, ordem por dependência)", "epic", 2),
        block("Princípio orientador da seleção", "task", 3),
      ],
    };
    const { nodes } = convertToGraph(extraction, "test.md");

    expect(nodes[0].metadata?.implementable).toBe(false);
    expect(nodes[1].metadata?.implementable).toBe(false);
  });

  it("does not mark requirement or risk nodes (only task/epic/subtask)", () => {
    const extraction: ExtractionResult = {
      summary: { totalSections: 0, epics: 0, tasks: 0, subtasks: 0, requirements: 0, constraints: 0, acceptanceCriteria: 0, risks: 0, unknown: 0 },
      blocks: [
        block("Roadmap sugerido pós-MVP", "requirement", 2),
      ],
    };
    const { nodes } = convertToGraph(extraction, "test.md");
    expect(nodes[0].metadata?.implementable).toBeUndefined();
  });
});
