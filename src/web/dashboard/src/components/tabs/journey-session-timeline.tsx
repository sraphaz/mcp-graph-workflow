/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 4.2: JourneySessionTimeline
 *
 * Timeline vertical estilo "log strip" for browser-harness audit events.
 * Session list on the left; virtualized event timeline on the right.
 */

import { useState, useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useJourneySessions, useJourneySessionEvents } from "@/hooks/use-journey-sessions";
import type { BhAuditEvent } from "@/lib/types";

// ── Outcome badge ────────────────────────────────────────────────────────────

function OutcomeBadge({ result }: { result: unknown }): React.JSX.Element {
  const ok = result !== null && result !== undefined;
  return (
    <span
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
        ok ? "bg-emerald-900/40 text-emerald-300" : "bg-slate-700 text-slate-400"
      }`}
    >
      {ok ? "ok" : "—"}
    </span>
  );
}

// ── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: BhAuditEvent }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const ts = new Date(event.at).toISOString().slice(11, 23);

  return (
    <li className="border-b border-slate-800/60 last:border-0">
      <button
        type="button"
        aria-label={event.action}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-800/40 transition-colors"
      >
        <span className="text-[10px] font-mono text-slate-500 tabular-nums w-[92px] shrink-0">{ts}</span>
        <span className="text-xs font-mono text-slate-200 truncate flex-1">{event.action}</span>
        <OutcomeBadge result={event.result} />
        <span className="text-slate-600 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {event.payload !== null && event.payload !== undefined && (
            <pre className="text-[11px] bg-slate-900 rounded p-2 overflow-x-auto text-slate-300 whitespace-pre-wrap break-all">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          )}
          {event.result !== null && event.result !== undefined && (
            <pre className="text-[11px] bg-slate-900 rounded p-2 overflow-x-auto text-slate-400 whitespace-pre-wrap break-all">
              {JSON.stringify(event.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

// ── Virtualized timeline (only for large lists) ──────────────────────────────

const VIRTUAL_THRESHOLD = 200;

function VirtualTimeline({ events }: { events: BhAuditEvent[] }): React.JSX.Element {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <ul
        role="list"
        aria-label="event timeline"
        style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${item.start}px)` }}
          >
            <EventRow event={events[item.index]!} />
          </div>
        ))}
      </ul>
    </div>
  );
}

function EventTimeline({ events }: { events: BhAuditEvent[] }): React.JSX.Element {
  if (events.length > VIRTUAL_THRESHOLD) {
    return <VirtualTimeline events={events} />;
  }
  return (
    <ul role="list" aria-label="event timeline" className="overflow-y-auto h-full divide-y divide-slate-800/60">
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
    </ul>
  );
}

// ── Session selector ─────────────────────────────────────────────────────────

function SessionList({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: Array<{ id: string; status: string; startedAt: number }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  if (sessions.length === 0) {
    return (
      <div className="p-4 text-slate-500 text-xs">No sessions</div>
    );
  }

  return (
    <ul className="overflow-y-auto h-full">
      {sessions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2 text-xs font-mono truncate ${
              selectedId === s.id
                ? "bg-slate-700 text-slate-100"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            {s.id}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function JourneySessionTimeline(): React.JSX.Element {
  const { sessions, loading: sessionsLoading } = useJourneySessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { events, loading: eventsLoading } = useJourneySessionEvents(selectedId);

  // Auto-select first session when list loads
  useEffect(() => {
    if (sessions.length > 0 && selectedId === null) {
      setSelectedId(sessions[0].id);
    }
  }, [sessions, selectedId]);

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Loading sessions…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        No sessions
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Session list */}
      <div className="w-48 shrink-0 border-r border-slate-800 flex flex-col">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 border-b border-slate-800">
          Sessions
        </div>
        <SessionList
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {/* Timeline */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!selectedId ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            Select a session
          </div>
        ) : eventsLoading ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
            No events
          </div>
        ) : (
          <EventTimeline events={events} />
        )}
      </div>
    </div>
  );
}
