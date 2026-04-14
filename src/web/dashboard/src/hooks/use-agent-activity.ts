import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

export interface AgentActivity {
  agentId: string;
  status: string;
  lastHeartbeat: string;
  activeLocks: number;
  currentTaskId: string | null;
}

export interface AgentActivityData {
  agents: AgentActivity[];
  teamTaskEnabled: boolean;
}

/**
 * Hook that fetches agent activity and auto-refreshes via SSE heartbeat events.
 */
export function useAgentActivity(): {
  data: AgentActivityData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<AgentActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getAgentActivity();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Subscribe to SSE for real-time updates
    const es = new EventSource("/api/v1/events");
    eventSourceRef.current = es;

    es.addEventListener("agent:heartbeat", () => {
      // Re-fetch on heartbeat to get latest status
      void load();
    });

    es.addEventListener("task:claimed", () => void load());
    es.addEventListener("task:released", () => void load());

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}
