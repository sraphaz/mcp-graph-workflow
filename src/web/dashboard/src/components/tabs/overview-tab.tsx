import { memo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Activity,
  Play,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useInsights } from "@/hooks/use-insights";
import { HealthGauge } from "@/components/charts/health-gauge";
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
      <div className="flex items-center gap-3">
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
    </div>
  );
});
