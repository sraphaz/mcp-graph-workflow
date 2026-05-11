/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-local-model-hub — Task 4.2: ModelHubTab
 *
 * Lists backends (cards with health badge), discovered models,
 * latency p50/p95, and tokens/s throughput. No savings, no quality.
 */

import { useModelHub, type BackendEntry } from "@/hooks/use-model-hub";

function HealthBadge({ status }: { status: "online" | "offline" }): React.JSX.Element {
  const isOnline = status === "online";
  return (
    <span
      role="status"
      aria-label={isOnline ? "online" : "offline"}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${
        isOnline
          ? "bg-emerald-900/40 text-emerald-300 border-emerald-700"
          : "bg-red-900/40 text-red-300 border-red-700"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-red-400"}`}
      />
      {isOnline ? "online" : "offline"}
    </span>
  );
}

function InferenceSpinner(): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label="inference running"
      className="inline-block h-3 w-3 rounded-full border-2 border-slate-600 border-t-amber-400 animate-spin"
    />
  );
}

function BackendCard({ backend }: { backend: BackendEntry }): React.JSX.Element {
  const { id, status, models, lastError, latencyP50, latencyP95, tokensThroughput, inferenceRunning } = backend;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        status === "online"
          ? "border-slate-700 bg-slate-800/60"
          : "border-red-900/60 bg-slate-800/60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-mono text-slate-200 truncate">{id}</span>
        <HealthBadge status={status} />
      </div>

      {/* Latency */}
      {(latencyP50 !== undefined || latencyP95 !== undefined) && (
        <div className="flex gap-4 text-xs text-slate-400">
          {latencyP50 !== undefined && (
            <span>
              <span className="text-slate-500">p50 </span>
              <span className="text-slate-300">{latencyP50} ms</span>
            </span>
          )}
          {latencyP95 !== undefined && (
            <span>
              <span className="text-slate-500">p95 </span>
              <span className="text-slate-300">{latencyP95} ms</span>
            </span>
          )}
        </div>
      )}

      {/* Inference status */}
      {inferenceRunning && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <InferenceSpinner />
          <span>
            inferring
            {tokensThroughput !== undefined && (
              <>
                {" · "}
                <span className="tabular-nums">{tokensThroughput}</span>
                {" tok/s"}
              </>
            )}
          </span>
        </div>
      )}

      {/* Models */}
      {models.length > 0 && (
        <ul className="space-y-1">
          {models.map((m) => (
            <li key={m} className="text-xs text-slate-400 font-mono truncate">
              {m}
            </li>
          ))}
        </ul>
      )}

      {/* Last error (offline only) */}
      {status === "offline" && lastError && (
        <p className="text-xs text-red-400 truncate">{lastError}</p>
      )}
    </div>
  );
}

export function ModelHubTab(): React.JSX.Element {
  const { backends } = useModelHub();

  if (backends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
        No backends detected
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
      {backends.map((b) => (
        <BackendCard key={b.id} backend={b} />
      ))}
    </div>
  );
}
