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

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import type { FlowSnapshot } from "@/lib/types";
import { computeBurndownChartData } from "@/lib/burndown-utils";

interface BurndownChartProps {
  data: FlowSnapshot[];
  className?: string;
}

export function BurndownChart({ data, className }: BurndownChartProps): React.JSX.Element {
  const chartData = computeBurndownChartData(data);
  if (chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted h-[220px] ${className ?? ""}`}>
        No burndown data available
      </div>
    );
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
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
          <ReferenceLine y={0} stroke="var(--color-border)" />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#6b7280"
            strokeDasharray="5 5"
            dot={false}
            name="Ideal"
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Actual"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
