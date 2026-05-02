/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Formula Consistency Analyzer — validates formula nodes for consistency.
 *
 * Checks:
 * - Metadata has expression, inputs, outputs
 * - No conflicting output variables (multiple formulas same output)
 * - All referenced inputs exist as outputs of other formulas or are declared external
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface FormulaConsistencyReport {
  formulas: Array<{ nodeId: string; title: string; valid: boolean; issues: string[] }>;
  conflicts: Array<{ output: string; formulaIds: string[] }>;
  totalFormulas: number;
  validCount: number;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** analyzeFormulaConsistency — auto-generated description placeholder. */
export function analyzeFormulaConsistency(doc: GraphDocument): FormulaConsistencyReport {
  const formulaNodes = doc.nodes.filter((n) => n.type === "formula");

  // Build output→formulaId map for conflict detection
  const outputMap = new Map<string, string[]>();
  // Build set of all known outputs for input resolution
  const allOutputs = new Set<string>();
  // Build set of declared external inputs
  const allExternalInputs = new Set<string>();

  // First pass: collect outputs and externals
  for (const node of formulaNodes) {
    const outputs = getStringArray(node.metadata?.outputs);
    for (const out of outputs) {
      allOutputs.add(out);
      const existing = outputMap.get(out) ?? [];
      existing.push(node.id);
      outputMap.set(out, existing);
    }
    const externals = getStringArray(node.metadata?.externalInputs);
    for (const ext of externals) {
      allExternalInputs.add(ext);
    }
  }

  // Second pass: validate each formula
  const formulas: FormulaConsistencyReport["formulas"] = [];
  let validCount = 0;

  for (const node of formulaNodes) {
    const issues: string[] = [];

    if (!node.metadata?.expression) {
      issues.push("Missing 'expression' in metadata");
    }
    if (!node.metadata?.inputs) {
      issues.push("Missing 'inputs' in metadata");
    }
    if (!node.metadata?.outputs) {
      issues.push("Missing 'outputs' in metadata");
    }

    // Check unresolved inputs
    const inputs = getStringArray(node.metadata?.inputs);
    for (const input of inputs) {
      if (!allOutputs.has(input) && !allExternalInputs.has(input)) {
        issues.push(`Input '${input}' is not provided by any formula output or declared external`);
      }
    }

    const valid = issues.length === 0;
    if (valid) validCount++;

    formulas.push({ nodeId: node.id, title: node.title, valid, issues });
  }

  // Detect conflicts: multiple formulas producing same output
  const conflicts: FormulaConsistencyReport["conflicts"] = [];
  for (const [output, ids] of outputMap.entries()) {
    if (ids.length > 1) {
      conflicts.push({ output, formulaIds: ids });
    }
  }

  logger.debug("analyzer:formula-consistency", {
    totalFormulas: formulaNodes.length,
    validCount,
    conflicts: conflicts.length,
  });

  return {
    formulas,
    conflicts,
    totalFormulas: formulaNodes.length,
    validCount,
  };
}
