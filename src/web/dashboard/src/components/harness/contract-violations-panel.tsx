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
import { apiClient } from "@/lib/api-client";

interface ContractViolation {
  id: number;
  rule_id: string;
  file: string;
  line: number;
  message: string;
  severity: string;
  node_id: string | null;
  created_at: string;
}

interface ViolationsData {
  violations: ContractViolation[];
  total: number;
}

/** ContractViolationsPanel — auto-generated description placeholder. */
export function ContractViolationsPanel(): React.JSX.Element {
  const [data, setData] = useState<ViolationsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch from harness endpoint — contract violations are stored in SQLite
        const result = await apiClient.request<ViolationsData>("/harness/contract-violations");
        setData(result);
      } catch {
        // Endpoint may not exist yet — show empty state
        setData({ violations: [], total: 0 });
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.violations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-edge bg-surface-alt/50 p-4 text-center">
        <p className="text-sm text-emerald-400 font-medium">No contract violations</p>
        <p className="text-xs text-muted mt-1">Architecture invariants are clean</p>
      </div>
    );
  }

  const errors = data.violations.filter((v) => v.severity === "error");
  const warnings = data.violations.filter((v) => v.severity === "warning");

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3">
        {errors.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            {errors.length} error{errors.length > 1 ? "s" : ""}
          </span>
        )}
        {warnings.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
            {warnings.length} warning{warnings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Violations List */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {data.violations.slice(0, 20).map((v) => (
          <div
            key={`${v.file}-${v.line}-${v.rule_id}`}
            className="flex items-start gap-2 rounded-lg border border-edge bg-surface p-2.5 text-xs"
          >
            <span className={v.severity === "error" ? "text-red-400 mt-0.5" : "text-amber-400 mt-0.5"}>
              {v.severity === "error" ? "\u2717" : "\u26A0"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{v.message}</p>
              <p className="text-muted mt-0.5">
                {v.file}:{v.line} — <span className="text-muted/70">{v.rule_id}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {data.total > 20 && (
        <p className="text-xs text-muted text-center">
          Showing 20 of {data.total} violations
        </p>
      )}
    </div>
  );
}
