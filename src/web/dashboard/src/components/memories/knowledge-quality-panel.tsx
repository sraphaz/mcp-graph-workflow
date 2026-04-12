import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { RefreshCw, Star } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface QualityDoc {
  id: string;
  title: string;
  sourceType: string;
  qualityScore?: number;
  createdAt?: string;
}

interface QualityStats {
  avgQuality: number;
  distribution: Array<{ bucket: string; count: number }>;
  bySource: Array<{ source: string; count: number; avgQuality: number }>;
  totalDocs: number;
}

const BUCKET_COLORS: Record<string, string> = {
  "0-0.2": "#ef4444",
  "0.2-0.4": "#f97316",
  "0.4-0.6": "#f59e0b",
  "0.6-0.8": "#22c55e",
  "0.8-1.0": "#10b981",
};

function computeStats(docs: QualityDoc[]): QualityStats {
  const withScore = docs.filter((d) => d.qualityScore != null);
  const avgQuality = withScore.length > 0
    ? withScore.reduce((s, d) => s + (d.qualityScore ?? 0), 0) / withScore.length
    : 0;

  const buckets = ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1.0"];
  const distribution = buckets.map((bucket) => {
    const [lo, hi] = bucket.split("-").map(Number);
    const count = withScore.filter((d) => (d.qualityScore ?? 0) >= lo && (d.qualityScore ?? 0) < hi).length;
    return { bucket, count, fill: BUCKET_COLORS[bucket] ?? "#6b7280" };
  });
  // Include exact 1.0 in last bucket
  distribution[4].count += withScore.filter((d) => d.qualityScore === 1).length;

  const sourceMap = new Map<string, { count: number; totalQ: number }>();
  for (const d of docs) {
    const src = d.sourceType || "unknown";
    const entry = sourceMap.get(src) ?? { count: 0, totalQ: 0 };
    entry.count++;
    entry.totalQ += d.qualityScore ?? 0;
    sourceMap.set(src, entry);
  }
  const bySource = [...sourceMap.entries()].map(([source, { count, totalQ }]) => ({
    source,
    count,
    avgQuality: count > 0 ? totalQ / count : 0,
  }));

  return { avgQuality, distribution, bySource, totalDocs: docs.length };
}

export function KnowledgeQualityPanel(): React.JSX.Element {
  const [stats, setStats] = useState<QualityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.knowledgeList(200);
      setStats(computeStats(res.documents));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 rounded bg-surface animate-pulse" />
        <div className="h-[200px] rounded-xl bg-surface animate-pulse" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-xs text-red-400 p-4">
        {error ?? "No data"}{" "}
        <button onClick={load} className="underline cursor-pointer">Retry</button>
      </div>
    );
  }

  const qualityPct = Math.round(stats.avgQuality * 100);
  const qualityColor = qualityPct >= 70 ? "#22c55e" : qualityPct >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-muted" />
          Knowledge Quality
        </h3>
        <button
          onClick={load}
          className="text-[10px] text-muted hover:text-foreground flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl border border-edge bg-surface-alt text-center">
          <div className="text-xl font-bold" style={{ color: qualityColor }}>{qualityPct}%</div>
          <div className="text-[10px] text-muted uppercase">Avg Quality</div>
        </div>
        <div className="p-3 rounded-xl border border-edge bg-surface-alt text-center">
          <div className="text-xl font-bold">{stats.totalDocs}</div>
          <div className="text-[10px] text-muted uppercase">Total Docs</div>
        </div>
        <div className="p-3 rounded-xl border border-edge bg-surface-alt text-center">
          <div className="text-xl font-bold">{stats.bySource.length}</div>
          <div className="text-[10px] text-muted uppercase">Sources</div>
        </div>
      </div>

      {/* Quality Distribution */}
      <div className="p-4 rounded-xl border border-edge bg-surface-alt">
        <h4 className="text-xs font-semibold text-muted uppercase mb-2">Quality Distribution</h4>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.distribution} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
            <XAxis dataKey="bucket" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                background: "var(--color-bg-secondary)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#6b7280">
              {/* Colors applied via data.fill property */}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Source Breakdown */}
      {stats.bySource.length > 0 && (
        <div className="p-4 rounded-xl border border-edge bg-surface-alt">
          <h4 className="text-xs font-semibold text-muted uppercase mb-2">By Source</h4>
          <div className="space-y-1.5">
            {stats.bySource
              .sort((a, b) => b.count - a.count)
              .map((src) => {
                const pct = Math.round(src.avgQuality * 100);
                const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={src.source} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                      <span className="text-foreground">{src.source}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{src.count} docs</span>
                      <span className="font-medium" style={{ color }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
