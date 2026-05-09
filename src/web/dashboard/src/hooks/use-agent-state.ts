/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-agent-explode-view — Task 2.1: useAgentState hook
 * Combines /agents/now + /agents/trail + /agents/next + /agents/learnings
 * with SSE for incremental trail updates. Cleanup on unmount via AbortController.
 */

import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "/api/v1/agents";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentNow {
  phase: string;
  idle: boolean;
  activeSession: string | null;
  activeRun?: { runId: string; currentStep: number };
  currentTool?: { name: string; calledAt: string } | null;
}

export interface TrailEntry {
  step: number;
  tool: string;
  at: string;
}

export interface AgentTrail {
  entries: TrailEntry[];
}

export interface AgentNext {
  nextTask: { id: string; title: string } | null;
}

export interface AgentLearnings {
  learnings: string[];
}

export interface AgentState {
  now: AgentNow | null;
  trail: AgentTrail | null;
  next: AgentNext | null;
  learnings: AgentLearnings | null;
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgentState(): AgentState {
  const [now, setNow] = useState<AgentNow | null>(null);
  const [trail, setTrail] = useState<AgentTrail | null>(null);
  const [next, setNext] = useState<AgentNext | null>(null);
  const [learnings, setLearnings] = useState<AgentLearnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const loadAll = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [nowData, trailData, nextData, learningsData] = await Promise.all([
        fetchJson<AgentNow>(`${BASE}/now`, signal),
        fetchJson<AgentTrail>(`${BASE}/trail`, signal).catch(() => ({ entries: [] })),
        fetchJson<AgentNext>(`${BASE}/next`, signal).catch(() => ({ nextTask: null })),
        fetchJson<AgentLearnings>(`${BASE}/learnings`, signal).catch(() => ({ learnings: [] })),
      ]);
      setNow(nowData);
      setTrail(trailData);
      setNext(nextData);
      setLearnings(learningsData);
    } catch (err) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Failed to load agent state");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void loadAll(ctrl.signal);

    const es = new EventSource("/api/v1/events");
    esRef.current = es;

    const onStep = (evt: Event) => {
      try {
        const entry: TrailEntry = JSON.parse((evt as MessageEvent).data) as TrailEntry;
        setTrail((prev) => ({
          entries: [...(prev?.entries ?? []), entry],
        }));
      } catch {
        // malformed event — skip
      }
    };

    es.addEventListener("agent:step", onStep);

    return () => {
      ctrl.abort();
      es.removeEventListener("agent:step", onStep);
      es.close();
      esRef.current = null;
      abortRef.current = null;
    };
  }, [loadAll]);

  return { now, trail, next, learnings, loading, error };
}
