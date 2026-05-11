/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 4.2: useJourneySessions / useJourneySessionEvents hooks
 *
 * Fetches browser-harness session list and per-session audit events
 * from the journey REST endpoints.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { BhSession, BhAuditEvent } from "@/lib/types";

const BASE = "/api/v1/journey";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface JourneySessionsState {
  sessions: BhSession[];
  loading: boolean;
}

export interface JourneySessionEventsState {
  events: BhAuditEvent[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

export function useJourneySessions(): JourneySessionsState {
  const [sessions, setSessions] = useState<BhSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<{ sessions: BhSession[] }>(`${BASE}/sessions`)
      .then((data) => { if (!cancelled) setSessions(data.sessions); })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { sessions, loading };
}

export function useJourneySessionEvents(sessionId: string | null): JourneySessionEventsState {
  const [events, setEvents] = useState<BhAuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const sessionRef = useRef(sessionId);

  useEffect(() => {
    sessionRef.current = sessionId;
    if (!sessionId) {
      setEvents([]);
      setCursor(null);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setEvents([]);
    setCursor(null);

    fetchJson<{ events: BhAuditEvent[]; nextCursor: string | null }>(
      `${BASE}/sessions/${sessionId}?limit=100`,
    )
      .then((data) => {
        if (!cancelled && sessionRef.current === sessionId) {
          setEvents(data.events);
          setCursor(data.nextCursor);
          setHasMore(data.nextCursor !== null);
        }
      })
      .catch(() => { if (!cancelled) setEvents([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [sessionId]);

  const loadMore = useCallback(() => {
    if (!sessionId || !cursor || loading) return;
    setLoading(true);
    fetchJson<{ events: BhAuditEvent[]; nextCursor: string | null }>(
      `${BASE}/sessions/${sessionId}?limit=100&cursor=${encodeURIComponent(cursor)}`,
    )
      .then((data) => {
        if (sessionRef.current === sessionId) {
          setEvents((prev) => [...prev, ...data.events]);
          setCursor(data.nextCursor);
          setHasMore(data.nextCursor !== null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, cursor, loading]);

  return { events, loading, hasMore, loadMore };
}
