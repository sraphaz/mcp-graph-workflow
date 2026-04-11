import { memo } from "react";
import type { KanbanMetrics as KanbanMetricsType } from "@/lib/types";

interface KanbanMetricsProps {
  metrics: KanbanMetricsType;
}

export const KanbanMetrics = memo(function KanbanMetrics({ metrics }: KanbanMetricsProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-edge bg-surface-alt text-xs">
      <MetricItem label="Throughput" value={`${metrics.throughput} done`} />
      <MetricItem label="Avg Cycle" value={metrics.avgCycleTime > 0 ? `${metrics.avgCycleTime}h` : "—"} />
      <MetricItem label="Avg Lead" value={metrics.avgLeadTime > 0 ? `${metrics.avgLeadTime}h` : "—"} />
      <MetricItem
        label="Blocked"
        value={`${metrics.blockedPercentage}%`}
        warn={metrics.blockedPercentage > 20}
      />
      {metrics.wipViolations.length > 0 && (
        <span className="text-red-400 font-medium">
          {metrics.wipViolations.length} WIP violation{metrics.wipViolations.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
});

function MetricItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-muted">{label}:</span>
      <span className={`font-medium ${warn ? "text-red-400" : "text-foreground"}`}>{value}</span>
    </div>
  );
}
