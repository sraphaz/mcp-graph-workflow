/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §AgentMonitor — composite hook for the agent-detail panel.
 * Fetches work payload + per-file diff on demand. Re-runs on the
 * same heartbeat / claim / release SSE events that drive the agent
 * list, so the right pane stays in sync with the left.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

export interface AgentWorkChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface AgentWorkPayload {
  agent: {
    agentId: string;
    status: string;
    lastHeartbeat: string;
    activeLocks: number;
    currentTaskId: string | null;
  };
  projectPhase: string;
  currentTask: {
    id: string;
    title: string;
    status: string;
    lifecyclePhase: string;
    startedAt: string | null;
    acceptanceCriteria: ReadonlyArray<{ text: string; done: boolean }>;
  } | null;
  changedFiles: AgentWorkChangedFile[];
  changedFileCount: number;
}

export interface FileDiffPayload {
  path: string;
  baseRef: string;
  diff: string;
  truncated: boolean;
  byteCount: number;
}

export function useAgentWork(agentId: string | null): {
  data: AgentWorkPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<AgentWorkPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    if (!agentId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.request<AgentWorkPayload>(
        `/agents/${encodeURIComponent(agentId)}/work`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent work");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void load();

    if (!agentId) return;

    const es = new EventSource("/api/v1/events");
    eventSourceRef.current = es;

    const onChange = (): void => {
      void load();
    };
    es.addEventListener("agent:heartbeat", onChange);
    es.addEventListener("task:claimed", onChange);
    es.addEventListener("task:released", onChange);
    es.addEventListener("node:updated", onChange);

    return (): void => {
      es.removeEventListener("agent:heartbeat", onChange);
      es.removeEventListener("task:claimed", onChange);
      es.removeEventListener("task:released", onChange);
      es.removeEventListener("node:updated", onChange);
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId, load]);

  return { data, loading, error, refresh: load };
}

export async function fetchFileDiff(
  agentId: string,
  path: string,
  baseRef: string = "HEAD",
): Promise<FileDiffPayload> {
  const params = new URLSearchParams({ path, baseRef });
  return apiClient.request<FileDiffPayload>(
    `/agents/${encodeURIComponent(agentId)}/diff?${params.toString()}`,
  );
}

export interface AgentEvent {
  id: number;
  type: string;
  createdAt: string;
  payload: unknown;
}

export interface AgentEventsPayload {
  agentId: string;
  events: AgentEvent[];
  limit: number;
}

export function useAgentEvents(
  agentId: string | null,
  limit: number = 20,
): { data: AgentEvent[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<AgentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    if (!agentId) {
      setData([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.request<AgentEventsPayload>(
        `/agents/${encodeURIComponent(agentId)}/events?limit=${limit}`,
      );
      setData(result.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [agentId, limit]);

  useEffect(() => {
    void load();
    if (!agentId) return;

    const es = new EventSource("/api/v1/events");
    eventSourceRef.current = es;
    const refresh = (): void => {
      void load();
    };
    es.addEventListener("agent:heartbeat", refresh);
    es.addEventListener("task:claimed", refresh);
    es.addEventListener("task:released", refresh);
    es.addEventListener("node:updated", refresh);

    return (): void => {
      es.removeEventListener("agent:heartbeat", refresh);
      es.removeEventListener("task:claimed", refresh);
      es.removeEventListener("task:released", refresh);
      es.removeEventListener("node:updated", refresh);
      es.close();
      eventSourceRef.current = null;
    };
  }, [agentId, load]);

  return { data, loading, error };
}
