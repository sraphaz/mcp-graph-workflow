import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import type { FlowSnapshot } from "@/lib/types";

interface BurndownChartProps {
  data: FlowSnapshot[];
  className?: string;
}

export function BurndownChart({ data, className }: BurndownChartProps): React.JSX.Element {
  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted h-[220px] ${className ?? ""}`}>
        No burndown data available
      </div>
    );
  }

  const total = data[0].backlogCount + data[0].readyCount + data[0].inProgressCount + data[0].blockedCount + data[0].doneCount;

  const chartData = data.map((s, i) => {
    const remaining = s.backlogCount + s.readyCount + s.inProgressCount + s.blockedCount;
    const idealRemaining = Math.max(0, total - (total / Math.max(data.length - 1, 1)) * i);
    return {
      date: s.snapshotDate.slice(5),
      actual: remaining,
      ideal: Math.round(idealRemaining),
    };
  });

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
