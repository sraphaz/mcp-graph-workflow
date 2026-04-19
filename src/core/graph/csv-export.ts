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

import type { GraphDocument } from "./graph-types.js";

export interface CsvExportOptions {
  filterStatus?: string[];
  filterType?: string[];
}

const CSV_HEADERS = [
  "id",
  "type",
  "title",
  "status",
  "priority",
  "sprint",
  "xpSize",
  "tags",
  "parentId",
  "acceptanceCriteria",
] as const;

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Export a graph document to CSV format with optional status/type filters. */
export function graphToCsv(
  doc: GraphDocument,
  options?: CsvExportOptions,
): string {
  let nodes = doc.nodes;

  if (options?.filterStatus) {
    const statuses = new Set(options.filterStatus);
    nodes = nodes.filter((n) => statuses.has(n.status));
  }

  if (options?.filterType) {
    const types = new Set(options.filterType);
    nodes = nodes.filter((n) => types.has(n.type));
  }

  const rows = nodes.map((n) =>
    [
      n.id,
      n.type,
      escapeCsv(n.title),
      n.status,
      String(n.priority),
      n.sprint ?? "",
      n.xpSize ?? "",
      (n.tags ?? []).join(";"),
      n.parentId ?? "",
      JSON.stringify(n.acceptanceCriteria ?? []),
    ].join(","),
  );

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}
