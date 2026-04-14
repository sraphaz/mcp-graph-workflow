import { useState, useEffect } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { apiClient } from "@/lib/api-client";

interface QualityMetric {
  sourceType: string;
  count: number;
  avgQuality: number;
  score: number;
  isLow: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  prd: "PRD",
  memory: "Memory",
  decision: "Decision",
  web_capture: "Capture",
  docs: "Docs",
  design: "Design",
  challenge_report: "Challenge",
  skill: "Skill",
  sprint_plan: "Sprint",
  phase_summary: "Phase",
};

/**
 * Knowledge Quality Radar — shows quality distribution per source type.
 * Low-quality sources (avgQuality < 40) highlighted in red.
 */
export function KnowledgeQualityRadar({ className }: { className?: string }): React.JSX.Element {
  const [data, setData] = useState<QualityMetric[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getKnowledgeQuality()
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-[260px] ${className ?? ""}`}>
        <div className="w-32 h-32 rounded-full border-2 border-edge animate-pulse" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted h-[260px] ${className ?? ""}`}>
        No knowledge data — index knowledge first
      </div>
    );
  }

  const chartData = data.map((m) => ({
    subject: SOURCE_LABELS[m.sourceType] ?? m.sourceType,
    score: m.score,
    quality: m.avgQuality,
    count: m.count,
    isLow: m.isLow,
    fullMark: 100,
  }));

  const hasLow = data.some((m) => m.isLow);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="var(--color-edge)" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "var(--color-muted)" }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar
            name="Quality"
            dataKey="score"
            stroke="#4263eb"
            fill="#4263eb"
            fillOpacity={0.3}
          />
          {hasLow && (
            <Radar
              name="Low Quality"
              dataKey={(d: Record<string, unknown>) => (d.isLow ? d.score : 0) as number}
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.2}
            />
          )}
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: unknown, _name: unknown, props: unknown) => {
              const p = (props as { payload?: Record<string, unknown> }).payload;
              if (!p) return [String(value), "Score"];
              return [`${value} (quality: ${p.quality}, docs: ${p.count})`, "Score"];
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
