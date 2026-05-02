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
import { CheckCircle2, XCircle, Minus } from "lucide-react";

interface ScoreResponse {
  ok: boolean;
  score: number;
  grade: string;
  currentPhase: string;
}

interface PhaseGate {
  phase: string;
  label: string;
  minScore: number | null;
  minGrade: string | null;
}

const PHASE_GATES: PhaseGate[] = [
  { phase: "ANALYZE",   label: "Analyze",   minScore: null, minGrade: null },
  { phase: "DESIGN",    label: "Design",    minScore: 55,   minGrade: "C" },
  { phase: "PLAN",      label: "Plan",      minScore: null, minGrade: null },
  { phase: "IMPLEMENT", label: "Implement", minScore: null, minGrade: null },
  { phase: "VALIDATE",  label: "Validate",  minScore: null, minGrade: null },
  { phase: "REVIEW",    label: "Review",    minScore: 55,   minGrade: "C" },
  { phase: "HANDOFF",   label: "Handoff",   minScore: 55,   minGrade: "C" },
  { phase: "DEPLOY",    label: "Deploy",    minScore: 70,   minGrade: "B" },
  { phase: "LISTENING", label: "Listening", minScore: null, minGrade: null },
];

/** PhaseGatesStatus — auto-generated description placeholder. */
export function PhaseGatesStatus(): React.JSX.Element {
  const [data, setData] = useState<ScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/harness/score")
      .then((res) => res.json())
      .then((json) => setData(json as ScoreResponse))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm p-4">Phase gates error: {error}</div>;
  }

  if (!data) {
    return <div className="text-gray-500 text-sm p-4">Loading phase gates...</div>;
  }

  return (
    <div className="space-y-1" role="list" aria-label="Phase gates status">
      {PHASE_GATES.map((gate) => {
        const isCurrent = data.currentPhase === gate.phase;
        const hasGate = gate.minScore !== null;
        const passes = hasGate ? data.score >= gate.minScore! : null;

        return (
          <div
            key={gate.phase}
            role="listitem"
            className={`flex items-center gap-3 px-3 py-1.5 rounded text-sm transition-colors ${
              isCurrent ? "bg-blue-500/10 border-l-2 border-blue-400" : "border-l-2 border-transparent"
            }`}
          >
            <span className={`w-20 font-medium ${isCurrent ? "text-blue-300" : "text-gray-300"}`}>
              {gate.label}
            </span>

            <span className="flex-1 text-xs text-gray-500">
              {hasGate ? `>= ${gate.minGrade}/${gate.minScore}` : "No gate"}
            </span>

            <span className="flex items-center gap-1">
              {passes === true && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-400" aria-hidden="true" />
                  <span className="text-xs text-green-400">Pass ({data.score})</span>
                </>
              )}
              {passes === false && (
                <>
                  <XCircle className="w-4 h-4 text-red-400" aria-hidden="true" />
                  <span className="text-xs text-red-400">Fail ({data.score})</span>
                </>
              )}
              {passes === null && (
                <>
                  <Minus className="w-4 h-4 text-gray-600" aria-hidden="true" />
                  <span className="text-xs text-gray-600">&mdash;</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
