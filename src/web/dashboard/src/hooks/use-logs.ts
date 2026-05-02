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
import type { LogEntry } from "@/lib/types";

interface UseLogsResult {
  logs: LogEntry[];
  loading: boolean;
  clearLogs: () => Promise<void>;
  refresh: () => Promise<void>;
}

/** useLogs — auto-generated description placeholder. */
export function useLogs(): UseLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const maxSeenIdRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    try {
      const { logs: fetched } = await apiClient.getLogs();
      setLogs(fetched);
      if (fetched.length > 0) {
        maxSeenIdRef.current = fetched[fetched.length - 1].id;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    await apiClient.clearLogs();
    setLogs([]);
    maxSeenIdRef.current = 0;
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // SSE streaming for real-time log entries
  useEffect(() => {
    const es = new EventSource("/api/v1/events");

    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data);
        const entry: LogEntry = {
          id: event.payload.id,
          level: event.payload.level,
          message: event.payload.message,
          context: event.payload.context,
          timestamp: event.timestamp,
        };

        if (entry.id > maxSeenIdRef.current) {
          maxSeenIdRef.current = entry.id;
          setLogs((prev) => [...prev, entry]);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener("log:entry", handler);

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.removeEventListener("log:entry", handler);
      es.close();
    };
  }, []);

  return { logs, loading, clearLogs, refresh: fetchLogs };
}
