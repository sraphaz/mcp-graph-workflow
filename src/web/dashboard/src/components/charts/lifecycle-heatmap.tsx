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

import type { PhaseDistributionEntry } from "@/hooks/use-insights";

interface LifecycleHeatmapProps {
  data: PhaseDistributionEntry[];
  className?: string;
}

/** Short labels for compact display */
const PHASE_SHORT: Record<string, string> = {
  ANALYZE: "ANL",
  DESIGN: "DES",
  PLAN: "PLN",
  IMPLEMENT: "IMP",
  VALIDATE: "VAL",
  REVIEW: "REV",
  HANDOFF: "HND",
  DEPLOY: "DPL",
  LISTENING: "LST",
};

/**
 * Lifecycle Phase Heatmap — grid of 9 phases with color intensity by task count.
 * Hover tooltip shows task count and percentage.
 */
export function LifecycleHeatmap({ data, className }: LifecycleHeatmapProps): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted ${className ?? ""}`}>
        No phase data
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.taskCount), 1);

  return (
    <div className={className}>
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {data.map((entry) => {
          const intensity = entry.taskCount / maxCount;
          const opacity = entry.taskCount === 0 ? 0.1 : 0.2 + intensity * 0.8;

          return (
            <div
              key={entry.phase}
              className="relative flex flex-col items-center justify-center rounded-lg p-3 min-h-[72px] transition-transform hover:scale-105 cursor-default"
              style={{ backgroundColor: hexToRgba(entry.color, opacity) }}
              title={`${entry.phase}: ${entry.taskCount} tasks (${entry.percentage}%)`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-foreground">
                {PHASE_SHORT[entry.phase] ?? entry.phase}
              </span>
              <span
                className="text-lg font-bold mt-0.5"
                style={{ color: entry.color }}
              >
                {entry.taskCount}
              </span>
              <span className="text-[9px] text-muted">
                {entry.percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
