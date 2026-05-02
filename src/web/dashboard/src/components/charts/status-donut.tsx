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

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import type { NodeStatus } from "@/lib/types";

interface StatusDonutProps {
  data: Array<{ status: NodeStatus; count: number; percentage: number }>;
  className?: string;
  onSliceClick?: (status: NodeStatus) => void;
  activeStatus?: NodeStatus | null;
}

/** StatusDonut — auto-generated description placeholder. */
export function StatusDonut({ data, className, onSliceClick, activeStatus }: StatusDonutProps): React.JSX.Element {
  const filtered = data.filter((d) => d.count > 0);

  if (filtered.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted ${className ?? ""}`}>
        No status data
      </div>
    );
  }

  const chartData = filtered.map((d) => ({
    name: STATUS_LABELS[d.status],
    value: d.count,
    fill: STATUS_COLORS[d.status],
    status: d.status,
  }));

  const handleClick = onSliceClick
    ? (_data: unknown, index: number): void => {
        const entry = chartData[index];
        if (entry) onSliceClick(entry.status);
      }
    : undefined;

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
            onClick={handleClick}
            style={onSliceClick ? { cursor: "pointer" } : undefined}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.fill}
                opacity={activeStatus && activeStatus !== entry.status ? 0.3 : 1}
                stroke={activeStatus === entry.status ? entry.fill : undefined}
                strokeWidth={activeStatus === entry.status ? 3 : 0}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--color-bg-secondary)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
