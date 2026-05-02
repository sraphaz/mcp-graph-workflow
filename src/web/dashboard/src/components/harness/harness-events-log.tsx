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

import { useState, useEffect } from "react";
import { TrendingDown, AlertTriangle, Activity } from "lucide-react";

interface HarnessEvent {
  type: "scan" | "warning" | "regression";
  score: number;
  grade: string;
  delta: number | null;
  message: string;
  timestamp: string;
  gitCommit: string | null;
}

interface EventsResponse {
  ok: boolean;
  events: HarnessEvent[];
}

const EVENT_CONFIG: Record<string, { Icon: typeof Activity; borderClass: string; textClass: string }> = {
  regression: { Icon: TrendingDown, borderClass: "border-l-red-500", textClass: "text-red-400" },
  warning: { Icon: AlertTriangle, borderClass: "border-l-amber-500", textClass: "text-amber-400" },
  scan: { Icon: Activity, borderClass: "border-l-blue-500", textClass: "text-blue-400" },
};

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

/** HarnessEventsLog — auto-generated description placeholder. */
export function HarnessEventsLog(): React.JSX.Element {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/harness/events")
      .then((res) => res.json())
      .then((json) => setData(json as EventsResponse))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return <div className="text-red-400 text-sm p-4">Events log error: {error}</div>;
  }

  if (!data) {
    return <div className="text-gray-500 text-sm p-4">Loading harness events...</div>;
  }

  if (data.events.length === 0) {
    return (
      <div className="text-gray-400 text-sm p-4">
        No harness events yet. Run a harness scan to start tracking.
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1" role="log" aria-label="Harness events">
      {data.events.map((event, idx) => {
        const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.scan;
        const { Icon } = config;

        return (
          <div
            key={`${event.timestamp}-${idx}`}
            className={`flex items-start gap-2 px-3 py-2 rounded bg-gray-800/60 border-l-2 ${config.borderClass}`}
          >
            <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.textClass}`} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 leading-relaxed">{event.message}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                <span>{formatTimestamp(event.timestamp)}</span>
                {event.gitCommit && (
                  <span className="font-mono">{event.gitCommit.slice(0, 7)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
