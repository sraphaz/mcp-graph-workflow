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

import { useAutonomyStatus, useAutonomySession, useAutonomyBudget } from "@/hooks/use-autonomy";

/** AutopilotTab — auto-generated description placeholder. */
export function AutopilotTab(): React.JSX.Element {
  const { data: status, loading: statusLoading, error } = useAutonomyStatus();
  const { data: session, loading: sessionLoading } = useAutonomySession();
  const { data: budget, loading: budgetLoading } = useAutonomyBudget();

  if (statusLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-5 w-48 rounded bg-surface animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-edge bg-surface-alt animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load autonomy data</p>
          <p className="text-xs text-muted mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!status) return <div />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Autopilot Monitor</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          status.autopilotActive
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-zinc-500/20 text-zinc-400"
        }`}>
          {status.autopilotActive ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard label="Phase" value={status.phase} />
        <StatusCard
          label="Harness"
          value={`${status.harnessScore} (${status.harnessGrade})`}
          color={status.harnessScore >= 70 ? "emerald" : status.harnessScore >= 55 ? "amber" : "red"}
        />
        <StatusCard label="Test Gate" value={status.gates.testGate} />
        <StatusCard label="Contract Gate" value={status.gates.contractGate} />
      </div>

      {/* Pipeline Wiring Status */}
      <div className="rounded-xl border border-edge bg-surface-alt p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Pipeline Wiring (M.A.P.A.)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(status.pipeline).map(([key, wired]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className={wired ? "text-emerald-400" : "text-red-400"}>
                {wired ? "\u2713" : "\u2717"}
              </span>
              <span className="text-muted">{formatPipelineKey(key)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Session Info */}
      {!sessionLoading && session?.active && session.session && (
        <div className="rounded-xl border border-edge bg-surface-alt p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">Active Session</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatusCard label="Sprint" value={session.session.sprintId} />
            <StatusCard label="Completed" value={String(session.session.tasksCompleted)} color="emerald" />
            <StatusCard label="Failed" value={String(session.session.tasksFailed)} color={session.session.tasksFailed > 0 ? "red" : "emerald"} />
            <StatusCard label="Status" value={session.session.status} />
          </div>
        </div>
      )}

      {/* Token Budget Distribution */}
      {!budgetLoading && budget && (
        <div className="rounded-xl border border-edge bg-surface-alt p-4">
          <h3 className="text-sm font-medium text-foreground mb-3">
            Token Budget ({budget.source === "learned" ? "Q-Learning" : budget.source})
          </h3>
          <div className="space-y-2">
            <BudgetBar label="Graph" value={budget.distribution.graph} total={4000} color="blue" />
            <BudgetBar label="Knowledge" value={budget.distribution.knowledge} total={4000} color="purple" />
            <BudgetBar label="Code" value={budget.distribution.code} total={4000} color="emerald" />
            <BudgetBar label="History" value={budget.distribution.history} total={4000} color="amber" />
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted">
            <span>Preset: {budget.preset}</span>
            <span>Q-visits: {budget.qLearning.totalVisits}</span>
            <span>Convergence: {(budget.qLearning.convergenceRate * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Inactive State */}
      {!status.autopilotActive && (
        <div className="rounded-xl border border-dashed border-edge bg-surface-alt/50 p-6 text-center">
          <p className="text-sm text-muted mb-2">Autopilot is not active</p>
          <p className="text-xs text-muted/70">
            Enable with: <code className="px-1.5 py-0.5 rounded bg-surface text-foreground">
              set_phase(phase, autopilot: true, sprintId: "...")
            </code>
          </p>
        </div>
      )}
    </div>
  );
}

function StatusCard({ label, value, color }: { label: string; value: string; color?: string }): React.JSX.Element {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    red: "text-red-400",
    blue: "text-blue-400",
  };
  return (
    <div className="rounded-lg border border-edge bg-surface p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${color ? colorMap[color] ?? "text-foreground" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function BudgetBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }): React.JSX.Element {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted w-20">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-surface">
        <div
          className={`h-full rounded-full ${colorMap[color] ?? "bg-blue-500"}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted w-12 text-right">{value}</span>
    </div>
  );
}

function formatPipelineKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace("Wired", "")
    .trim();
}
