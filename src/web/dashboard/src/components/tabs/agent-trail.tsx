/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_76ece58f4105 — Task 2.3: <AgentTrail> — expandable timeline.
 * Vertical list with page-based virtualization (no external lib).
 * Each item expands inline to show payload + causality children.
 */

import { useState, useCallback } from "react";

export interface TrailEvent {
  id: string;
  kind: string;
  timestamp: string;
  durationMs: number | null;
  payload: string | null;
  subjectRef: { kind: string; id: string } | null;
}

interface TrailItemProps {
  event: TrailEvent;
  expanded: boolean;
  childEvents: TrailEvent[];
  onToggle: (id: string) => void;
}

const KIND_ICON: Record<string, string> = {
  "tool.invoked": "◉",
  "tool.step": "→",
  "node:updated": "✓",
  "node:created": "✓",
  error: "✗",
};

function formatRelative(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function TrailItem({ event, expanded, childEvents, onToggle }: TrailItemProps): React.JSX.Element {
  const icon = KIND_ICON[event.kind] ?? "◉";
  let payloadObj: unknown = null;
  if (event.payload) {
    try { payloadObj = JSON.parse(event.payload); } catch { payloadObj = event.payload; }
  }

  return (
    <li className="border-b border-edge last:border-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-muted text-xs w-4 shrink-0">{icon}</span>
        <button
          className="flex-1 flex items-center gap-2 text-left hover:text-foreground text-foreground/80"
          aria-label={`toggle ${event.id}`}
          onClick={() => onToggle(event.id)}
        >
          <span className="text-xs font-mono">{event.kind}</span>
          <span className="text-[10px] text-muted">{formatRelative(event.timestamp)}</span>
          {event.durationMs !== null && (
            <span className="text-[10px] text-muted">{event.durationMs}ms</span>
          )}
        </button>
        {event.subjectRef && (
          <a
            href={`#${event.subjectRef.id}`}
            className="text-[10px] text-accent hover:underline shrink-0"
            aria-label={event.subjectRef.id}
          >
            {event.subjectRef.id}
          </a>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {payloadObj !== null && (
            <pre
              data-testid={`payload-${event.id}`}
              className="text-[10px] font-mono bg-surface-alt rounded p-2 overflow-x-auto"
            >
              {typeof payloadObj === "string" ? payloadObj : JSON.stringify(payloadObj, null, 2)}
            </pre>
          )}
          {childEvents.length > 0 && (
            <ul className="pl-4 border-l border-edge space-y-0.5">
              {childEvents.map((child) => (
                <li key={child.id} className="flex items-center gap-2 py-0.5">
                  <span className="text-[10px] font-mono text-muted">{child.kind}</span>
                  <span className="text-[10px] text-muted">{formatRelative(child.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

interface AgentTrailProps {
  events: TrailEvent[];
  pageSize?: number;
  onExpandCausality?: (eventId: string) => Promise<TrailEvent[]>;
}

/** AgentTrail — paginated, expandable event timeline. */
export function AgentTrail({ events, pageSize = 20, onExpandCausality }: AgentTrailProps): React.JSX.Element {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childMap, setChildMap] = useState<Map<string, TrailEvent[]>>(new Map());

  const handleToggle = useCallback(async (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (onExpandCausality && !childMap.has(id)) {
          void onExpandCausality(id).then((children) => {
            setChildMap((m) => new Map(m).set(id, children));
          });
        }
      }
      return next;
    });
  }, [childMap, onExpandCausality]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted text-xs">
        No events to display
      </div>
    );
  }

  const visible = events.slice(0, visibleCount);
  const hasMore = visibleCount < events.length;

  return (
    <div className="flex flex-col" data-testid="agent-trail">
      <ul role="list" className="divide-y divide-edge">
        {visible.map((event) => (
          <TrailItem
            key={event.id}
            event={event}
            expanded={expanded.has(event.id)}
            childEvents={childMap.get(event.id) ?? []}
            onToggle={(id) => void handleToggle(id)}
          />
        ))}
      </ul>
      {hasMore && (
        <button
          className="mt-2 px-3 py-1.5 text-xs text-muted border border-edge rounded hover:text-foreground self-center"
          onClick={() => setVisibleCount((n) => n + pageSize)}
        >
          Load more ({events.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
