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

import { Shield, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import type { SprintHealthReport } from "@/lib/types";

interface SprintHealthCardProps {
  report: SprintHealthReport;
  className?: string;
}

const HEALTH_CONFIG = {
  healthy: { color: "#22c55e", bgColor: "#22c55e18", Icon: CheckCircle, label: "Healthy" },
  at_risk: { color: "#f59e0b", bgColor: "#f59e0b18", Icon: AlertTriangle, label: "At Risk" },
  critical: { color: "#ef4444", bgColor: "#ef444418", Icon: AlertCircle, label: "Critical" },
} as const;

export function SprintHealthCard({ report, className }: SprintHealthCardProps): React.JSX.Element {
  if (report.metrics.taskCount === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted p-4 rounded-xl border border-edge bg-surface-alt ${className ?? ""}`}>
        No tasks in sprint
      </div>
    );
  }

  const config = HEALTH_CONFIG[report.health];
  const { metrics } = report;
  const burndownPct = Math.round(metrics.burndownRatio * 100);

  return (
    <div className={`p-4 rounded-xl border border-edge bg-surface-alt space-y-3 ${className ?? ""}`}>
      {/* Health badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted" />
          <span className="text-xs font-semibold text-muted uppercase">Sprint Health</span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{ color: config.color, background: config.bgColor }}
        >
          <config.Icon className="w-3.5 h-3.5" />
          {config.label}
        </div>
      </div>

      {/* Burndown progress */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted">Burndown</span>
          <span className="font-medium">{metrics.doneCount}/{metrics.taskCount} ({burndownPct}%)</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${burndownPct}%`, background: config.color }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-surface-elevated">
          <div className="font-bold text-sm">{metrics.totalPoints}</div>
          <div className="text-muted">Points</div>
        </div>
        <div className="p-2 rounded-lg bg-surface-elevated">
          <div className="font-bold text-sm" style={metrics.blockedCount > 0 ? { color: "#ef4444" } : undefined}>
            {metrics.blockedCount}
          </div>
          <div className="text-muted">Blocked</div>
        </div>
        <div className="p-2 rounded-lg bg-surface-elevated">
          <div className="font-bold text-sm">{metrics.externalDeps}</div>
          <div className="text-muted">Ext Deps</div>
        </div>
      </div>

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="space-y-1">
          {report.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted">
              <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: config.color }} />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
