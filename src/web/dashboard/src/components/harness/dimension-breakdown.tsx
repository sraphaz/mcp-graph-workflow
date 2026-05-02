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

import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";

interface DimensionInfo {
  score: number;
  weight: number;
}

interface ScoreResponse {
  ok: boolean;
  score: number;
  grade: string;
  breakdown: Record<string, DimensionInfo>;
}

const DIMENSION_LABELS: Record<string, string> = {
  types: "Type Coverage",
  tests: "Test Coverage",
  fitness: "Architecture",
  docs: "Documentation",
  naming: "Naming Clarity",
  errorHandling: "Error Handling",
  contextDensity: "Context Density",
};

const DIMENSION_ORDER = ["types", "tests", "fitness", "docs", "naming", "errorHandling", "contextDensity"];

function getBarColor(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 55) return "bg-yellow-500";
  return "bg-red-500";
}

/** DimensionBreakdown — auto-generated description placeholder. */
export function DimensionBreakdown(): React.JSX.Element {
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/harness/score")
      .then((res) => res.json())
      .then((json) => setData(json as ScoreResponse))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <div className="text-red-400 text-sm p-4">Breakdown error: {error}</div>;
  if (!data) return <div className="text-zinc-500 text-sm p-4">Loading dimensions...</div>;

  const breakdown = data.breakdown;

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center gap-2 text-zinc-300 mb-3">
        <BarChart3 className="w-4 h-4" />
        <span className="text-sm font-medium">Dimension Breakdown</span>
      </div>

      {DIMENSION_ORDER.map((dim) => {
        const info = breakdown[dim];
        if (!info) return null;
        const label = DIMENSION_LABELS[dim] ?? dim;
        const weightPct = Math.round(info.weight * 100);

        return (
          <div key={dim} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{label} ({weightPct}%)</span>
              <span className={`font-mono ${info.score < 60 ? "text-red-400" : info.score < 70 ? "text-yellow-400" : "text-zinc-300"}`}>
                {info.score}%
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getBarColor(info.score)}`}
                style={{ width: `${info.score}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
