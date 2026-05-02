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

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { FlowSnapshot } from "@/lib/types";

interface CfdChartProps {
  data: FlowSnapshot[];
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  done: "#22c55e",
  in_progress: "#3b82f6",
  ready: "#a855f7",
  blocked: "#ef4444",
  backlog: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  done: "Done",
  in_progress: "In Progress",
  ready: "Ready",
  blocked: "Blocked",
  backlog: "Backlog",
};

/** CfdChart — auto-generated description placeholder. */
export function CfdChart({ data, className }: CfdChartProps): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted h-[220px] ${className ?? ""}`}>
        No flow data yet — snapshots are captured daily
      </div>
    );
  }

  const chartData = data.map((s) => ({
    date: s.snapshotDate.slice(5), // MM-DD
    backlog: s.backlogCount,
    ready: s.readyCount,
    in_progress: s.inProgressCount,
    blocked: s.blockedCount,
    done: s.doneCount,
  }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {(["done", "in_progress", "ready", "blocked", "backlog"] as const).map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              fill={STATUS_COLORS[key]}
              stroke={STATUS_COLORS[key]}
              fillOpacity={0.7}
              name={STATUS_LABELS[key]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
