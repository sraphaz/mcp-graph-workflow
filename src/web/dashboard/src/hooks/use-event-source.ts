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

import { useEffect, useRef, useCallback, useState } from "react";

interface GraphSSEEvent {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface UseEventSourceOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number;
  /**
   * Event types to listen for. The SSE backend writes `event: <type>` per
   * message (see api/routes/events-sse.ts), and EventSource only dispatches
   * named listeners via addEventListener — there is no wildcard. So callers
   * must enumerate the types they care about. Defaults to the canonical
   * graph mutation set if omitted.
   */
  eventTypes?: string[];
}

const DEFAULT_EVENT_TYPES = [
  "node:created",
  "node:updated",
  "node:deleted",
  "edge:created",
  "edge:deleted",
  "import:completed",
  "task:claimed",
  "task:released",
  "agent:heartbeat",
] as const;

interface UseEventSourceReturn {
  /** Whether connected to SSE stream */
  connected: boolean;
  /** Last received event */
  lastEvent: GraphSSEEvent | null;
  /** Manually reconnect */
  reconnect: () => void;
}

/**
 * React hook for SSE-based real-time dashboard updates.
 * Connects to /api/v1/events/stream and triggers callbacks on graph changes.
 */
export function useEventSource(
  onEvent: (event: GraphSSEEvent) => void,
  options: UseEventSourceOptions = {},
): UseEventSourceReturn {
  const { autoReconnect = true, reconnectDelay = 3000, eventTypes } = options;
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<GraphSSEEvent | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const disposedRef = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (disposedRef.current) return;
    if (sourceRef.current) {
      sourceRef.current.close();
    }
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const baseUrl = window.location.origin;
    const source = new EventSource(`${baseUrl}/api/v1/events/stream`);
    sourceRef.current = source;

    const onConnected = () => {
      setConnected(true);
    };

    const onMessage = (e: MessageEvent): void => {
      try {
        const data: unknown = JSON.parse(e.data);
        const evt: GraphSSEEvent = {
          type: (e as MessageEvent & { type: string }).type,
          payload: (data && typeof data === "object" ? data : {}) as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        };
        setLastEvent(evt);
        onEventRef.current(evt);
      } catch {
        // Invalid JSON — ignore
      }
    };

    const subscribed = (eventTypes && eventTypes.length > 0)
      ? eventTypes
      : (DEFAULT_EVENT_TYPES as readonly string[]);

    source.addEventListener("connected", onConnected);
    for (const evtName of subscribed) {
      source.addEventListener(evtName, onMessage);
    }

    source.onerror = (): void => {
      setConnected(false);
      source.close();
      sourceRef.current = null;
      source.removeEventListener("connected", onConnected);
      for (const evtName of subscribed) {
        source.removeEventListener(evtName, onMessage);
      }

      if (autoReconnect && !disposedRef.current) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, reconnectDelay);
      }
    };
  }, [autoReconnect, reconnectDelay, eventTypes]);

  useEffect(() => {
    disposedRef.current = false;
    connect();
    return () => {
      disposedRef.current = true;
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);

  return { connected, lastEvent, reconnect: connect };
}
