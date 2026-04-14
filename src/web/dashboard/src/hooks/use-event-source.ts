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
  /** Event types to listen for (default: all) */
  eventTypes?: string[];
}

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

    const onGraph = (e: MessageEvent) => {
      try {
        const event: GraphSSEEvent = JSON.parse(e.data);

        // Filter by event types if specified
        if (eventTypes && !eventTypes.some((t) => event.type.startsWith(t))) {
          return;
        }

        setLastEvent(event);
        onEventRef.current(event);
      } catch {
        // Invalid JSON — ignore
      }
    };

    source.addEventListener("connected", onConnected);
    source.addEventListener("graph", onGraph);

    source.onerror = () => {
      setConnected(false);
      source.close();
      sourceRef.current = null;
      source.removeEventListener("connected", onConnected);
      source.removeEventListener("graph", onGraph);

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
