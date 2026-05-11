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

import { memo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Activity,
  Play,
  ChevronDown,
  ChevronUp,
  Layers,
  Target,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { useLifecycleTrend, useLifecycleSnapshots } from "@/hooks/use-lifecycle-health";
import { HealthGauge } from "@/components/charts/health-gauge";
import { STATUS_COLORS } from "@/lib/constants";
import { safePercentage } from "@/lib/runtime-guards";
import type { TabId } from "@/components/layout/nav-config";

interface OverviewTabProps {
  onNavigate?: (tab: TabId) => void;
}

interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
}

function KpiCard({ label, value, subtitle, icon, color = "default", onClick }: KpiCardProps): React.JSX.Element {
  const colorClasses: Record<string, string> = {
    default: "text-foreground",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`
        flex flex-col gap-1 p-4 rounded-xl border border-edge bg-surface-alt
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:bg-surface-elevated hover:border-accent/30 hover:shadow-sm" : "cursor-default"}
        disabled:cursor-default disabled:opacity-80
      `}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted font-medium">{label}</span>
        <span className="text-muted opacity-60">{icon}</span>
      </div>
      <span className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</span>
      {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
    </button>
  );
}

interface BlockerItemProps {
  title: string;
  nodeId: string;
}

function BlockerItem({ title, nodeId }: BlockerItemProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-elevated transition-colors">
      <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
      <span className="text-xs text-foreground truncate">{title}</span>
      <span className="text-[10px] text-muted font-mono ml-auto flex-shrink-0">{nodeId.slice(0, 12)}</span>
    </div>
  );
}

export const OverviewTab = memo(function OverviewTab({ onNavigate }: OverviewTabProps) {
  const { data, loading } = useInsights();
  const { data: lcTrend, loading: lcTrendLoading } = useLifecycleTrend(10);
  const { data: lcSnaps, loading: lcSnapsLoading } = useLifecycleSnapshots(undefined, 20);
  const [blockersExpanded, setBlockersExpanded] = useState(false);

  if (loading || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-edge bg-surface-alt animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const { metrics, stats, bottlenecks, healthScore } = data;
  const done = stats.byStatus?.done ?? 0;
  const total = stats.totalNodes ?? 0;
  const inProgress = stats.byStatus?.in_progress ?? 0;
  const blocked = stats.byStatus?.blocked ?? 0;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const gradeMap = (score: number): string => {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    return "D";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Health Score + KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Health Gauge — spans 2 cols */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-edge bg-surface-alt">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted">Project Health</span>
            <span
              className="text-xs text-muted cursor-help"
              title="Composite score from completion rate, velocity, blocked ratio, and knowledge coverage"
            >
              Grade {gradeMap(healthScore)}
            </span>
          </div>
          <HealthGauge score={healthScore} />
        </div>

        {/* KPI Cards — spans 3 cols, 2x2 grid */}
        <div className="lg:col-span-3 grid grid-cols-2 gap-3">
          <KpiCard
            label="Completed"
            value={`${completionPct}%`}
            subtitle={`${done} of ${total} tasks`}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="success"
            onClick={() => onNavigate?.("insights")}
          />
          <KpiCard
            label="In Progress"
            value={inProgress}
            subtitle="active tasks"
            icon={<Activity className="w-4 h-4" />}
            color={inProgress > 0 ? "warning" : "default"}
            onClick={() => onNavigate?.("kanban")}
          />
          <KpiCard
            label="Blocked"
            value={blocked}
            subtitle={blocked > 0 ? "need attention" : "all clear"}
            icon={<AlertTriangle className="w-4 h-4" />}
            color={blocked > 0 ? "danger" : "default"}
            onClick={blocked > 0 ? () => setBlockersExpanded(!blockersExpanded) : undefined}
          />
          <KpiCard
            label="Velocity"
            value={metrics.velocity?.tasksCompleted ?? 0}
            subtitle="tasks this sprint"
            icon={<BarChart3 className="w-4 h-4" />}
            onClick={() => onNavigate?.("insights")}
          />
        </div>
      </div>

      {/* Blockers Detail — expandable */}
      {blocked > 0 && blockersExpanded && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <button
            type="button"
            onClick={() => setBlockersExpanded(false)}
            className="flex items-center gap-2 w-full text-left cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-foreground">Blocked Tasks ({blocked})</span>
            <ChevronUp className="w-4 h-4 text-muted ml-auto" />
          </button>
          <div className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
            {(bottlenecks.blockedTasks ?? []).slice(0, 10).map((task) => (
              <BlockerItem key={task.id} title={task.title} nodeId={task.id} />
            ))}
          </div>
        </div>
      )}

      {blocked > 0 && !blockersExpanded && (
        <button
          type="button"
          onClick={() => setBlockersExpanded(true)}
          className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {blocked} blocked task{blocked > 1 ? "s" : ""} — click to expand
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => onNavigate?.("graph")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-light transition-colors cursor-pointer"
        >
          <Play className="w-4 h-4" />
          Start Next Task
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.("kanban")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-edge rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          Kanban Board
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.("prd-backlog")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-edge rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          View Backlog
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.("harness")}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-edge rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer"
        >
          Harness Score
        </button>
      </div>

      {/* Status Distribution + Sprint Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <div className="p-4 rounded-xl border border-edge bg-surface-alt">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-muted" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Status Distribution</h3>
          </div>
          <div className="space-y-2">
            {metrics.statusDistribution?.map((sd) => (
              (() => {
                const percentage = safePercentage(sd.percentage);
                return (
              <div key={sd.status} className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-muted truncate">{sd.status.replace("_", " ")}</span>
                <div className="flex-1 h-3 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${percentage}%`, backgroundColor: STATUS_COLORS[sd.status] || "#6b7280" }}
                  />
                </div>
                <span className="text-[10px] font-mono text-muted w-10 text-right">{sd.count}</span>
              </div>
                );
              })()
            ))}
          </div>
        </div>

        {/* Sprint Progress */}
        <div className="p-4 rounded-xl border border-edge bg-surface-alt">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-muted" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Sprint Progress</h3>
          </div>
          {metrics.sprintProgress && metrics.sprintProgress.length > 0 ? (
            <div className="space-y-2.5">
              {metrics.sprintProgress.slice(0, 5).map((sp) => (
                (() => {
                  const percentage = safePercentage(sp.percentage);
                  return (
                <div key={sp.sprint}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{sp.sprint}</span>
                    <span className="text-[10px] text-muted">{sp.done}/{sp.total} ({percentage}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">No sprints defined yet</p>
          )}
        </div>
      </div>

      {/* Warnings row: Missing AC + Oversized Tasks + Knowledge */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Missing Acceptance Criteria */}
        <button
          type="button"
          onClick={() => onNavigate?.("insights")}
          className="p-3 rounded-xl border border-edge bg-surface-alt hover:bg-surface-elevated transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] font-semibold text-muted uppercase">Missing AC</span>
          </div>
          <span className={`text-lg font-bold ${bottlenecks.missingAcceptanceCriteria.length > 0 ? "text-amber-400" : "text-emerald-500"}`}>
            {bottlenecks.missingAcceptanceCriteria.length}
          </span>
          <p className="text-[10px] text-muted">tasks without criteria</p>
        </button>

        {/* Oversized Tasks */}
        <button
          type="button"
          onClick={() => onNavigate?.("insights")}
          className="p-3 rounded-xl border border-edge bg-surface-alt hover:bg-surface-elevated transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] font-semibold text-muted uppercase">Oversized</span>
          </div>
          <span className={`text-lg font-bold ${bottlenecks.oversizedTasks.length > 0 ? "text-orange-400" : "text-emerald-500"}`}>
            {bottlenecks.oversizedTasks.length}
          </span>
          <p className="text-[10px] text-muted">need decomposition</p>
        </button>

        {/* Knowledge Coverage */}
        <button
          type="button"
          onClick={() => onNavigate?.("memories")}
          className="p-3 rounded-xl border border-edge bg-surface-alt hover:bg-surface-elevated transition-colors text-left cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-semibold text-muted uppercase">Knowledge</span>
          </div>
          <span className="text-lg font-bold text-blue-400">
            {data.knowledgeStats.total}
          </span>
          <p className="text-[10px] text-muted">indexed documents</p>
        </button>
      </div>

      {/* Phase Distribution */}
      {data.phaseDistribution.length > 0 && (
        <div className="p-4 rounded-xl border border-edge bg-surface-alt">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-muted" />
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Task Distribution by Phase</h3>
          </div>
          <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
            {data.phaseDistribution.map((pd) => (
              <div
                key={pd.phase}
                className="relative group"
                style={{ width: `${pd.percentage}%`, backgroundColor: pd.color, minWidth: pd.taskCount > 0 ? 4 : 0 }}
                title={`${pd.phase}: ${pd.taskCount} tasks (${pd.percentage}%)`}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface border border-edge rounded px-2 py-1 text-[10px] whitespace-nowrap shadow-lg z-10">
                  {pd.phase}: {pd.taskCount} ({pd.percentage}%)
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {data.phaseDistribution.filter(pd => pd.taskCount > 0).map((pd) => (
              <div key={pd.phase} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pd.color }} />
                <span className="text-[10px] text-muted">{pd.phase} ({pd.taskCount})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lifecycle Health ──────────────────────────────────── */}
      <section className="p-4 rounded-xl border border-edge bg-surface-alt space-y-4" aria-labelledby="lh-heading">
        <h2 id="lh-heading" className="text-sm font-semibold text-foreground">Lifecycle Health</h2>

        {/* Success rate */}
        <div>
          <h3 className="text-xs font-medium text-muted mb-2">Rolling success rate (last 10 snapshots)</h3>
          {lcTrendLoading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : lcTrend && lcTrend.samples > 0 ? (
            <div className="flex items-baseline gap-4">
              <span className="text-2xl font-semibold text-foreground">
                {Math.round(lcTrend.successRate * 100)}%
              </span>
              <span className="text-xs text-muted">
                {lcTrend.passed}/{lcTrend.samples} passed all 9 phases
              </span>
              {lcTrend.latestPassedAll !== null && (
                <span className={
                  lcTrend.latestPassedAll
                    ? "text-xs px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800"
                    : "text-xs px-2 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800"
                }>
                  {lcTrend.latestPassedAll ? "latest: pass" : "latest: fail"}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted">
              No snapshots yet. Run <code>analyze(prd_lifecycle_health)</code> to seed.
            </p>
          )}
        </div>

        {/* Recent snapshots */}
        {!lcSnapsLoading && lcSnaps.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted mb-2">Recent snapshots</h3>
            <ul className="divide-y divide-edge">
              {lcSnaps.slice(0, 5).map((s) => (
                <li key={s.id} className="py-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      aria-label={s.passedAll ? "passed" : "failed"}
                      className={s.passedAll ? "h-2 w-2 rounded-full bg-emerald-500 shrink-0" : "h-2 w-2 rounded-full bg-red-500 shrink-0"}
                    />
                    <span className="text-xs text-foreground truncate">{s.epicId ?? "(project)"}</span>
                    {s.report?.summary && (
                      <span className="text-[10px] text-muted truncate">— {s.report.summary}</span>
                    )}
                  </div>
                  <time dateTime={s.takenAt} className="text-[10px] text-muted shrink-0">{s.takenOn}</time>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
});
