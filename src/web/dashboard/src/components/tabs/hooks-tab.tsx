/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { useEffect, useState, type ReactElement } from "react";

interface HookHandlerStatRow {
  id: string;
  callCount: number;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  lastError: string | null;
  circuitState: "closed" | "open" | "half-open";
  updatedAt: string;
}

interface HooksStatsResponse {
  ok: boolean;
  totalHandlers: number;
  channels: Record<string, number>;
  handlers: HookHandlerStatRow[];
}

export function HooksTab(): ReactElement {
  const [data, setData] = useState<HooksStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async (): Promise<void> => {
      try {
        const res = await fetch("/api/hooks/stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as HooksStatsResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchStats();
    const id = setInterval(fetchStats, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) return <div className="p-6 text-muted">Loading hook stats…</div>;
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Hooks</h1>
        <p className="text-muted">No stats endpoint yet. The MCP <code>hooks</code> tool's <code>stats</code> action is the canonical source.</p>
        <p className="text-xs text-muted mt-2">Last fetch error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4" id="panel-hooks" role="tabpanel" aria-labelledby="tab-hooks">
      <header>
        <h1 className="text-xl font-semibold">Hooks</h1>
        <p className="text-sm text-muted">
          {data?.totalHandlers ?? 0} registered handlers · stats refresh every 5s
        </p>
      </header>
      <table className="w-full text-sm">
        <thead className="text-left text-muted border-b border-edge">
          <tr>
            <th className="py-2 pr-4">Handler</th>
            <th className="py-2 pr-4">Calls</th>
            <th className="py-2 pr-4">p50 (ms)</th>
            <th className="py-2 pr-4">p95 (ms)</th>
            <th className="py-2 pr-4">Circuit</th>
            <th className="py-2 pr-4">Last error</th>
          </tr>
        </thead>
        <tbody>
          {(data?.handlers ?? []).map((h) => (
            <tr key={h.id} className="border-b border-edge">
              <td className="py-2 pr-4 font-mono text-xs">{h.id}</td>
              <td className="py-2 pr-4">{h.callCount}</td>
              <td className="py-2 pr-4">{h.p50DurationMs?.toFixed(1) ?? "—"}</td>
              <td className="py-2 pr-4">{h.p95DurationMs?.toFixed(1) ?? "—"}</td>
              <td className="py-2 pr-4">
                <span className={h.circuitState === "open" ? "text-red-500" : h.circuitState === "half-open" ? "text-yellow-500" : "text-foreground"}>
                  {h.circuitState}
                </span>
              </td>
              <td className="py-2 pr-4 text-xs text-muted">{h.lastError ?? "—"}</td>
            </tr>
          ))}
          {(data?.handlers ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted">No handler activity yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
