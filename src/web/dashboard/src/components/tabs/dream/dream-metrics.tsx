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

import React from "react";
import type { DreamMetrics as DreamMetricsType } from "@/lib/types";

interface DreamMetricsProps {
  metrics: DreamMetricsType | null;
}

const CARDS = [
  { key: "totalCycles" as const, label: "Total Cycles", format: (v: number) => v.toString() },
  { key: "totalPruned" as const, label: "Docs Pruned", format: (v: number) => v.toLocaleString() },
  { key: "totalMerged" as const, label: "Docs Merged", format: (v: number) => v.toLocaleString() },
  { key: "avgQualityImprovement" as const, label: "Avg Quality Delta", format: (v: number) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%" },
];

/** DreamMetricsCards — auto-generated description placeholder. */
export function DreamMetricsCards({ metrics }: DreamMetricsProps): React.JSX.Element {
  if (!metrics) return <></>;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {CARDS.map(({ key, label, format }) => (
        <div
          key={key}
          className="p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt text-center"
        >
          <div className="text-xl font-bold">{format(metrics[key])}</div>
          <div className="text-[10px] text-muted uppercase">{label}</div>
        </div>
      ))}
    </div>
  );
}
