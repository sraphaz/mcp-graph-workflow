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

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Shield, AlertTriangle } from "lucide-react";

interface RemediationSuggestion {
  ruleId: string;
  file: string;
  line: number;
  dimension: string;
  violationType: string;
  suggestedFix: string;
  confidence: number;
  category: string;
  priority: number;
}

interface RemediateResponse {
  ok: boolean;
  score: number;
  grade: string;
  suggestions: RemediationSuggestion[];
  totalViolations: number;
}

const DIMENSION_COLORS: Record<string, string> = {
  types: "text-blue-400",
  tests: "text-green-400",
  naming: "text-yellow-400",
  errors: "text-red-400",
  context: "text-purple-400",
  docs: "text-cyan-400",
  fitness: "text-orange-400",
};

const CATEGORY_BADGES: Record<string, string> = {
  remove: "bg-red-900/50 text-red-300",
  replace: "bg-yellow-900/50 text-yellow-300",
  add: "bg-green-900/50 text-green-300",
  refactor: "bg-blue-900/50 text-blue-300",
};

/** RemediationPanel — auto-generated description placeholder. */
export function RemediationPanel(): React.JSX.Element {
  const [data, setData] = useState<RemediateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suppressing, setSuppressing] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch("/api/v1/harness/remediate")
      .then((res) => res.json())
      .then((json) => setData(json as RemediateResponse))
      .catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSuppress = useCallback(async (suggestion: RemediationSuggestion) => {
    const key = `${suggestion.file}:${suggestion.violationType}`;
    setSuppressing(key);
    try {
      const res = await fetch("/api/v1/harness/remediate/suppress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: suggestion.file,
          violationType: suggestion.violationType,
          dimension: suggestion.dimension,
          reason: "Suppressed from dashboard",
        }),
      });
      if (res.status === 201) {
        // Remove from local state without re-fetching
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            suggestions: prev.suggestions.filter(
              (s) => !(s.file === suggestion.file && s.violationType === suggestion.violationType),
            ),
          };
        });
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setSuppressing(null);
    }
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm p-4">Remediation error: {error}</div>;
  }

  if (!data) {
    return <div className="text-zinc-500 text-sm p-4">Loading remediations...</div>;
  }

  if (data.suggestions.length === 0) {
    return (
      <div className="flex items-center gap-2 p-4 text-green-400">
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm font-medium">All dimensions healthy — no remediations needed</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2 text-zinc-300">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">
            {data.suggestions.length} remediation{data.suggestions.length !== 1 ? "s" : ""} — {data.totalViolations} violations detected
          </span>
        </div>
        <span className="text-xs text-zinc-500">Score: {data.score} ({data.grade})</span>
      </div>

      <div className="space-y-1 px-2">
        {data.suggestions.map((s, i) => (
          <div
            key={`${s.file}:${s.line}:${s.violationType}:${i}`}
            className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-zinc-500">{s.ruleId}</span>
                <span className={`text-xs font-medium ${DIMENSION_COLORS[s.dimension] ?? "text-zinc-400"}`}>
                  {s.dimension}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${CATEGORY_BADGES[s.category] ?? "bg-zinc-700 text-zinc-300"}`}>
                  {s.category}
                </span>
                <span className="text-xs text-zinc-600">P{s.priority}</span>
              </div>
              <div className="text-sm text-zinc-300 truncate">{s.suggestedFix}</div>
              <div className="text-xs text-zinc-500 font-mono mt-0.5">{s.file}:{s.line}</div>
            </div>
            <button
              onClick={() => handleSuppress(s)}
              disabled={suppressing === `${s.file}:${s.violationType}`}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
              title="Suppress this suggestion"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Suppress</span>
            </button>
          </div>
        ))}
      </div>

      {data.totalViolations > data.suggestions.length && (
        <div className="flex items-center gap-1 px-4 py-1 text-xs text-zinc-600">
          <AlertTriangle className="w-3 h-3" />
          <span>{data.totalViolations - data.suggestions.length} violations without matching rules (no remediation available)</span>
        </div>
      )}
    </div>
  );
}
