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

import { TrendingUp, TrendingDown, Minus, Zap, Clock, AlertTriangle, Wrench } from "lucide-react";
import type { DoraMetrics } from "@/lib/types";

interface DoraCardsProps {
  dora: DoraMetrics;
  className?: string;
}

type DoraLevel = "elite" | "high" | "medium" | "low";

interface DoraBenchmark {
  label: string;
  color: string;
  bgColor: string;
}

const LEVELS: Record<DoraLevel, DoraBenchmark> = {
  elite: { label: "Elite", color: "#22c55e", bgColor: "#22c55e18" },
  high: { label: "High", color: "#3b82f6", bgColor: "#3b82f618" },
  medium: { label: "Medium", color: "#f59e0b", bgColor: "#f59e0b18" },
  low: { label: "Low", color: "#ef4444", bgColor: "#ef444418" },
};

function frequencyLevel(tasksPerDay: number): DoraLevel {
  if (tasksPerDay >= 3) return "elite";
  if (tasksPerDay >= 1) return "high";
  if (tasksPerDay >= 0.3) return "medium";
  return "low";
}

function leadTimeLevel(hoursP50: number): DoraLevel {
  if (hoursP50 <= 2) return "elite";
  if (hoursP50 <= 24) return "high";
  if (hoursP50 <= 168) return "medium";
  return "low";
}

function cfrLevel(rate: number): DoraLevel {
  if (rate <= 0.05) return "elite";
  if (rate <= 0.1) return "high";
  if (rate <= 0.2) return "medium";
  return "low";
}

function mttrLevel(hours: number): DoraLevel {
  if (hours <= 1) return "elite";
  if (hours <= 4) return "high";
  if (hours <= 24) return "medium";
  return "low";
}

function TrendIcon({ trend }: { trend: DoraMetrics["trend"] }): React.JSX.Element {
  if (trend === "improving") return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (trend === "declining") return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted" />;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function DoraCards({ dora, className }: DoraCardsProps): React.JSX.Element {
  const cards = [
    {
      icon: Zap,
      label: "Deploy Frequency",
      value: `${dora.deploymentFrequency.toFixed(1)}/day`,
      level: frequencyLevel(dora.deploymentFrequency),
    },
    {
      icon: Clock,
      label: "Lead Time (P50)",
      value: formatHours(dora.leadTime.p50),
      sublabel: `P85: ${formatHours(dora.leadTime.p85)} | P95: ${formatHours(dora.leadTime.p95)}`,
      level: leadTimeLevel(dora.leadTime.p50),
    },
    {
      icon: AlertTriangle,
      label: "Change Failure Rate",
      value: `${(dora.changeFailureRate * 100).toFixed(1)}%`,
      level: cfrLevel(dora.changeFailureRate),
    },
    {
      icon: Wrench,
      label: "MTTR",
      value: formatHours(dora.mttr),
      level: mttrLevel(dora.mttr),
    },
  ];

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${className ?? ""}`}>
      {cards.map((card) => {
        const bench = LEVELS[card.level];
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="p-3 rounded-xl border border-edge bg-surface-alt"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="w-4 h-4 text-muted" />
              <div className="flex items-center gap-1">
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ color: bench.color, background: bench.bgColor }}
                >
                  {bench.label}
                </span>
                <TrendIcon trend={dora.trend} />
              </div>
            </div>
            <div className="text-lg font-bold" style={{ color: bench.color }}>
              {card.value}
            </div>
            <div className="text-[10px] text-muted uppercase mt-0.5">{card.label}</div>
            {card.sublabel && (
              <div className="text-[9px] text-muted mt-1">{card.sublabel}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
