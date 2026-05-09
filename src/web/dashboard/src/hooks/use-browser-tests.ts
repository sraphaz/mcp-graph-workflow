/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 2.1: Hook use-browser-tests.
 *
 * Combines SSE (incremental updates) + REST (initial fetch + detail on demand).
 * Exponential backoff reconnect: 250ms → 4s, max 30s. Cleanup closes SSE.
 */

import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "/api/v1/browser-tests";
const SSE_EVENTS = ["test.started", "test.step", "test.passed", "test.failed", "test.broken"];

export interface BrowserTestRun {
  id: string;
  sessionId: string;
  nodeId: string | null;
  prompt: string;
  plan: unknown[];
  results: unknown[];
  verdict: string;
  durationMs: number;
  createdAt: number;
}

export interface UseBrowserTestsReturn {
  runs: BrowserTestRun[];
  activeRun: BrowserTestRun | null;
  loading: boolean;
  error: string | null;
  setActiveRunId: (id: string | null) => void;
}

export function useBrowserTests(): UseBrowserTestsReturn {
  const [runs, setRuns] = useState<BrowserTestRun[]>([]);
  const [activeRun, setActiveRun] = useState<BrowserTestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const retryDelayRef = useRef(250);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/runs?limit=50`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as BrowserTestRun[];
      if (mountedRef.current) {
        setRuns(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to load runs");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const es = new EventSource(`${BASE}/stream`);
    sseRef.current = es;

    const handleEvent = (evt: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const run = JSON.parse(evt.data as string) as BrowserTestRun;
        setRuns((prev) => {
          const filtered = prev.filter((r) => r.id !== run.id);
          return [run, ...filtered];
        });
      } catch {
        // malformed event — skip
      }
    };

    SSE_EVENTS.forEach((type) => es.addEventListener(type, handleEvent));

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      SSE_EVENTS.forEach((type) => es.removeEventListener(type, handleEvent));
      const delay = Math.min(retryDelayRef.current, 30000);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 4000);
      retryTimerRef.current = setTimeout(() => {
        retryDelayRef.current = 250;
        connect();
      }, delay);
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchRuns();
    connect();

    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [fetchRuns, connect]);

  const setActiveRunId = useCallback(
    (id: string | null) => {
      if (!id) {
        setActiveRun(null);
        return;
      }
      void (async () => {
        try {
          const res = await fetch(`${BASE}/runs/${id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const run = (await res.json()) as BrowserTestRun;
          if (mountedRef.current) setActiveRun(run);
        } catch (err) {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : "Failed to load run detail");
          }
        }
      })();
    },
    [],
  );

  return { runs, activeRun, loading, error, setActiveRunId };
}
