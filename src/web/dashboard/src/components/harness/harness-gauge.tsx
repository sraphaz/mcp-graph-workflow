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

interface HarnessScore {
  ok: boolean;
  score: number;
  grade: string;
  breakdown: Record<string, { score: number; weight: number }>;
  timestamp: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#3b82f6",
  C: "#f59e0b",
  D: "#ef4444",
};

const DIMENSION_LABELS: Record<string, string> = {
  types: "Type Coverage",
  tests: "Test Coverage",
  fitness: "Arch Fitness",
  docs: "Docs Coverage",
  naming: "Naming Clarity",
  errorHandling: "Error Handling",
  errors: "Error Handling",
  contextDensity: "Context Density",
  context: "Context Density",
};

export function HarnessGauge(): React.JSX.Element {
  const [data, setData] = useState<HarnessScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/harness/score")
      .then((res) => res.json())
      .then((json) => setData(json as HarnessScore))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm p-4">Harness scan error: {error}</div>;
  }

  if (!data) {
    return <div className="text-gray-500 text-sm p-4">Loading harness score...</div>;
  }

  const gradeColor = GRADE_COLORS[data.grade] ?? "#6b7280";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div
          className="text-5xl font-bold"
          style={{ color: gradeColor }}
        >
          {data.grade}
        </div>
        <div>
          <div className="text-2xl font-semibold text-white">{data.score}/100</div>
          <div className="text-xs text-gray-400">{data.timestamp}</div>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(data.breakdown).map(([dim, info]) => {
          const label = DIMENSION_LABELS[dim] ?? dim;
          const barColor = info.score >= 70 ? "#22c55e" : info.score >= 55 ? "#f59e0b" : "#ef4444";
          return (
            <div key={dim} className="flex items-center gap-2 text-sm">
              <span className="w-28 text-gray-300 truncate">{label}</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${info.score}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="w-10 text-right text-gray-400">{info.score}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
