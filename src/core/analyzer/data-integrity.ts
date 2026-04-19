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
 * Data Integrity Analyzer — validates data table nodes.
 *
 * Checks:
 * - Metadata has columns (array)
 * - If rowsPreview exists, validates basic integrity:
 *   - Probability columns sum to approximately 1.0
 *   - Cost values > 0
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface DataIntegrityReport {
  tables: Array<{ nodeId: string; title: string; valid: boolean; issues: string[] }>;
  totalTables: number;
  validCount: number;
}

interface RowPreview {
  [key: string]: unknown;
}

function getColumns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function getRowsPreview(value: unknown): RowPreview[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is RowPreview => typeof v === "object" && v !== null);
}

const PROBABILITY_EPSILON = 0.05;

export function analyzeDataIntegrity(doc: GraphDocument): DataIntegrityReport {
  const tableNodes = doc.nodes.filter((n) => n.type === "data_table");

  const tables: DataIntegrityReport["tables"] = [];
  let validCount = 0;

  for (const node of tableNodes) {
    const issues: string[] = [];
    const columns = getColumns(node.metadata?.columns);

    if (!node.metadata?.columns) {
      issues.push("Missing 'columns' in metadata");
    } else if (columns.length === 0) {
      issues.push("'columns' is empty");
    }

    // Validate rowsPreview if present
    const rows = getRowsPreview(node.metadata?.rowsPreview);
    if (rows.length > 0 && columns.length > 0) {
      // Find probability columns (name contains "probability", "prob", "chance", "weight")
      const probColumns = columns.filter((c) => /prob|chance|weight/i.test(c));
      for (const probCol of probColumns) {
        const values = rows
          .map((r) => r[probCol])
          .filter((v): v is number => typeof v === "number");

        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          if (Math.abs(sum - 1.0) > PROBABILITY_EPSILON) {
            issues.push(`Probability column '${probCol}' sums to ${sum.toFixed(3)}, expected ~1.0`);
          }
        }
      }

      // Find cost columns (name contains "cost", "price", "value")
      const costColumns = columns.filter((c) => /cost|price|value/i.test(c));
      for (const costCol of costColumns) {
        const values = rows
          .map((r) => r[costCol])
          .filter((v): v is number => typeof v === "number");

        for (const val of values) {
          if (val <= 0) {
            issues.push(`Cost column '${costCol}' has non-positive value: ${val}`);
            break; // Report once per column
          }
        }
      }
    }

    const valid = issues.length === 0;
    if (valid) validCount++;

    tables.push({ nodeId: node.id, title: node.title, valid, issues });
  }

  logger.debug("analyzer:data-integrity", {
    totalTables: tableNodes.length,
    validCount,
  });

  return {
    tables,
    totalTables: tableNodes.length,
    validCount,
  };
}
