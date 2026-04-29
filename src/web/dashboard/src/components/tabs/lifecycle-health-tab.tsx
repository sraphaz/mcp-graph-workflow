/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintF — Lifecycle Health dashboard tab.
 *
 * Shows the 9-phase régua trend, the most recent snapshot per epic,
 * and the rolling success-rate so a human can audit self-hosting in
 * 30 seconds.
 */

import { useLifecycleSnapshots, useLifecycleTrend } from "@/hooks/use-lifecycle-health";

export function LifecycleHealthTab(): React.JSX.Element {
  const { data: trend, loading: trendLoading } = useLifecycleTrend(10);
  const { data: snapshots, loading: snapsLoading } = useLifecycleSnapshots(undefined, 20);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      <header>
        <h2 className="text-lg font-semibold text-white">Lifecycle Health</h2>
        <p className="text-sm text-gray-400">
          9-phase régua de self-hosting. Each snapshot records whether all phases
          (ANALYZE → LISTENING) passed for an epic. Pass-rate over time is the
          headline metric for "is the agent staying in green".
        </p>
      </header>

      {/* Row 1: Success rate ─────────────────────────────────── */}
      <section
        className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
        aria-labelledby="lifecycle-success-rate"
      >
        <h3
          id="lifecycle-success-rate"
          className="text-sm font-medium text-gray-300 mb-3"
        >
          Rolling success rate (last 10 snapshots)
        </h3>
        {trendLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : trend && trend.samples > 0 ? (
          <div className="flex items-baseline gap-4">
            <span className="text-3xl font-semibold text-white">
              {Math.round(trend.successRate * 100)}%
            </span>
            <span className="text-sm text-gray-400">
              {trend.passed}/{trend.samples} passed all 9 phases
            </span>
            {trend.latestPassedAll !== null && (
              <span
                className={
                  trend.latestPassedAll
                    ? "text-xs px-2 py-0.5 rounded bg-green-900/40 text-green-400 border border-green-800"
                    : "text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-800"
                }
              >
                {trend.latestPassedAll ? "latest: pass" : "latest: fail"}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No snapshots yet. Run <code>analyze(prd_lifecycle_health, nodeId=&lt;epic&gt;)</code>{" "}
            to seed the trend.
          </p>
        )}
      </section>

      {/* Row 2: Recent snapshots ─────────────────────────────── */}
      <section
        className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
        aria-labelledby="lifecycle-snapshots"
      >
        <h3
          id="lifecycle-snapshots"
          className="text-sm font-medium text-gray-300 mb-3"
        >
          Recent snapshots
        </h3>
        {snapsLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-gray-500">No snapshots recorded.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {snapshots.map((s) => (
              <li
                key={s.id}
                className="py-2 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-label={s.passedAll ? "passed" : "failed"}
                    className={
                      s.passedAll
                        ? "h-2 w-2 rounded-full bg-green-500 shrink-0"
                        : "h-2 w-2 rounded-full bg-red-500 shrink-0"
                    }
                  />
                  <span className="text-sm text-gray-200 truncate">
                    {s.epicId ?? "(project)"}
                  </span>
                  {s.report?.summary && (
                    <span className="text-xs text-gray-500 truncate">
                      — {s.report.summary}
                    </span>
                  )}
                </div>
                <time
                  dateTime={s.takenAt}
                  className="text-xs text-gray-500 shrink-0"
                >
                  {s.takenOn}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
