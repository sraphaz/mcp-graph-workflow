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
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }

    const baseUrl = window.location.origin;
    const source = new EventSource(`${baseUrl}/api/v1/events/stream`);
    sourceRef.current = source;

    source.addEventListener("connected", () => {
      setConnected(true);
    });

    source.addEventListener("graph", (e: MessageEvent) => {
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
    });

    source.onerror = () => {
      setConnected(false);
      source.close();
      sourceRef.current = null;

      if (autoReconnect) {
        setTimeout(connect, reconnectDelay);
      }
    };
  }, [autoReconnect, reconnectDelay, eventTypes]);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);

  return { connected, lastEvent, reconnect: connect };
}
