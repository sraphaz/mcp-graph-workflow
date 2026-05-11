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

/**
 * §Story-10 / node_7061e54c3148 — RED/USE metrics card at top of Logs tab.
 * Polls GET /metrics every 5s and renders key counter and histogram values.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

type MetricsSnapshot = {
  counters: Record<string, number>;
  histograms: Record<string, { p50: number; p95: number; p99: number; count: number }>;
};

function StatChip({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center px-3 py-1.5 rounded bg-surface border border-edge min-w-[80px]">
      <span className="text-[10px] text-muted leading-none mb-0.5">{label}</span>
      <span className="text-xs font-mono font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** MetricsCard — RED/USE metrics summary card for the Logs tab. */
export function MetricsCard(): React.JSX.Element {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await apiClient.getSystemMetrics();
      setMetrics(data);
    } catch {
      // ignore — metrics are best-effort
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
    const id = setInterval(() => void fetchMetrics(), 5_000);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  if (!metrics) return <></>;

  const req = metrics.counters["http.requests.total"] ?? 0;
  const err = metrics.counters["http.errors.total"] ?? 0;
  const dur = metrics.histograms["http.duration.ms"];
  const errRate = metrics.counters["errors.rate"] ?? 0;
  const connActive = metrics.counters["sqlite.connections.active"] ?? 0;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-edge bg-surface-alt/50"
      data-testid="metrics-card"
    >
      <span className="text-[10px] text-muted font-semibold uppercase tracking-wide mr-1">RED/USE</span>
      <StatChip label="requests" value={req} />
      <StatChip label="errors" value={err} />
      {dur && <StatChip label="p50ms" value={dur.p50} />}
      {dur && <StatChip label="p95ms" value={dur.p95} />}
      <StatChip label="err.rate" value={errRate} />
      <StatChip label="db.conn" value={connActive} />
    </div>
  );
}
