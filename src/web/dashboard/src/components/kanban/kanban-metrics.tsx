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
