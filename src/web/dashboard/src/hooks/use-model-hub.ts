/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-local-model-hub — Task 4.2: useModelHub hook
 *
 * Subscribes to SSE /api/v1/model-hub/stream and builds live BackendEntry state.
 * p50/p95 computed from rolling window of last 20 inference.completed durations.
 */

import { useState, useEffect, useRef } from "react";

export interface BackendEntry {
  id: string;
  status: "online" | "offline";
  models: string[];
  lastError?: string;
  latencyP50?: number;
  latencyP95?: number;
  tokensThroughput?: number;
  inferenceRunning: boolean;
}

export interface ModelHubState {
  backends: BackendEntry[];
  connected: boolean;
}

const WINDOW_SIZE = 20;

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = p * sorted.length - 1;
  const lo = Math.max(0, Math.floor(rank));
  const hi = Math.min(Math.ceil(rank), sorted.length - 1);
  return Math.round(sorted[lo]! + (rank - lo) * (sorted[hi]! - sorted[lo]!));
}

export function useModelHub(): ModelHubState {
  const [backends, setBackends] = useState<BackendEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const latencyWindows = useRef<Record<string, number[]>>({});
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/v1/model-hub/stream");
    esRef.current = es;

    es.addEventListener("connected", () => setConnected(true));

    es.addEventListener("backend.online", (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as { backendId: string; models?: string[] };
      setBackends((prev) => {
        const existing = prev.find((b) => b.id === d.backendId);
        if (existing) {
          return prev.map((b) =>
            b.id === d.backendId ? { ...b, status: "online", models: d.models ?? b.models, lastError: undefined } : b,
          );
        }
        return [...prev, { id: d.backendId, status: "online", models: d.models ?? [], inferenceRunning: false }];
      });
    });

    es.addEventListener("backend.offline", (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as { backendId: string; error?: string };
      setBackends((prev) =>
        prev.map((b) =>
          b.id === d.backendId ? { ...b, status: "offline", lastError: d.error, inferenceRunning: false } : b,
        ),
      );
    });

    es.addEventListener("model.loaded", (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as { backendId: string; modelId: string };
      setBackends((prev) =>
        prev.map((b) =>
          b.id === d.backendId && !b.models.includes(d.modelId)
            ? { ...b, models: [...b.models, d.modelId] }
            : b,
        ),
      );
    });

    es.addEventListener("inference.started", (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as { backendId: string };
      setBackends((prev) =>
        prev.map((b) => (b.id === d.backendId ? { ...b, inferenceRunning: true } : b)),
      );
    });

    es.addEventListener("inference.completed", (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as {
        backendId: string;
        latencyMs?: number;
        tokensOut?: number;
      };
      const win = latencyWindows.current;
      if (d.latencyMs !== undefined) {
        win[d.backendId] = [...(win[d.backendId] ?? []), d.latencyMs].slice(-WINDOW_SIZE).sort((a, b) => a - b);
      }
      const sorted = win[d.backendId] ?? [];
      const tokensPerSec =
        d.tokensOut !== undefined && d.latencyMs !== undefined && d.latencyMs > 0
          ? Math.round((d.tokensOut / d.latencyMs) * 1000)
          : undefined;

      setBackends((prev) =>
        prev.map((b) =>
          b.id === d.backendId
            ? {
                ...b,
                inferenceRunning: false,
                latencyP50: pct(sorted, 0.5),
                latencyP95: pct(sorted, 0.95),
                ...(tokensPerSec !== undefined ? { tokensThroughput: tokensPerSec } : {}),
              }
            : b,
        ),
      );
    });

    es.addEventListener("inference.failed", (e: Event) => {
      const d = JSON.parse((e as MessageEvent).data) as { backendId: string; error?: string };
      setBackends((prev) =>
        prev.map((b) =>
          b.id === d.backendId ? { ...b, inferenceRunning: false, lastError: d.error } : b,
        ),
      );
    });

    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return { backends, connected };
}
