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

    const onHeartbeat = () => {
      void load();
    };
    const onTaskClaimed = () => {
      void load();
    };
    const onTaskReleased = () => {
      void load();
    };

    es.addEventListener("agent:heartbeat", onHeartbeat);
    es.addEventListener("task:claimed", onTaskClaimed);
    es.addEventListener("task:released", onTaskReleased);

    return () => {
      es.removeEventListener("agent:heartbeat", onHeartbeat);
      es.removeEventListener("task:claimed", onTaskClaimed);
      es.removeEventListener("task:released", onTaskReleased);
      es.close();
      eventSourceRef.current = null;
    };
  }, [load]);

  return { data, loading, error, refresh: load };
}
