import { useState, useEffect } from "react";

interface TrendEntry {
  score: number;
  grade: string;
  timestamp: string;
  gitCommit: string | null;
}

interface TrendData {
  ok: boolean;
  history: TrendEntry[];
  trend: "improving" | "degrading" | "stable" | "no_data";
  delta: number;
}

const TREND_LABELS: Record<string, { text: string; color: string }> = {
  improving: { text: "Improving", color: "#22c55e" },
  degrading: { text: "Degrading", color: "#ef4444" },
  stable: { text: "Stable", color: "#3b82f6" },
  no_data: { text: "No Data", color: "#6b7280" },
};

export function HarnessTrend(): React.JSX.Element {
  const [data, setData] = useState<TrendData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/harness/trend")
      .then((res) => res.json())
      .then((json) => setData(json as TrendData))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm p-4">Trend error: {error}</div>;
  }

  if (!data || data.trend === "no_data") {
    return <div className="text-gray-500 text-sm p-4">No harness history yet. Run analyze(harness_scan) to start tracking.</div>;
  }

  const trendInfo = TREND_LABELS[data.trend];
  const history = data.history;
  const maxScore = 100;
  const minScore = 0;
  const chartW = 400;
  const chartH = 120;
  const padX = 30;
  const padY = 10;

  const points = history.map((entry, i) => {
    const x = padX + (i / Math.max(history.length - 1, 1)) * (chartW - 2 * padX);
    const y = padY + ((maxScore - entry.score) / (maxScore - minScore)) * (chartH - 2 * padY);
    return { x, y, ...entry };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-300">Score Evolution</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: trendInfo.color }}>
            {trendInfo.text}
          </span>
          <span className="text-xs text-gray-400">
            (delta: {data.delta > 0 ? "+" : ""}{data.delta})
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32 bg-gray-800/50 rounded">
        {/* Grid lines */}
        {[25, 50, 75].map((v) => {
          const y = padY + ((maxScore - v) / (maxScore - minScore)) * (chartH - 2 * padY);
          return (
            <g key={v}>
              <line x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="#374151" strokeWidth="0.5" />
              <text x={padX - 4} y={y + 3} fill="#6b7280" fontSize="8" textAnchor="end">{v}</text>
            </g>
          );
        })}

        {/* Grade zones */}
        <rect x={padX} y={padY} width={chartW - 2 * padX}
          height={((maxScore - 85) / maxScore) * (chartH - 2 * padY)}
          fill="#22c55e10" />
        <rect x={padX}
          y={padY + ((maxScore - 85) / maxScore) * (chartH - 2 * padY)}
          width={chartW - 2 * padX}
          height={((85 - 70) / maxScore) * (chartH - 2 * padY)}
          fill="#3b82f610" />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={trendInfo.color}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={trendInfo.color} />
        ))}
      </svg>

      <div className="text-xs text-gray-500">
        {history.length} snapshots | Latest: {history[history.length - 1]?.score}/100 ({history[history.length - 1]?.grade})
      </div>
    </div>
  );
}
