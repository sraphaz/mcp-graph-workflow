/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_a7da930769e7 — Task 2.2: <AgentNow> — upper status card.
 * Shows phase, idle/active state, current tool, and live duration.
 * No external libs — Tailwind + CSS animation only.
 */

import { useState, useEffect } from "react";
import type { AgentNow as AgentNowState } from "@/hooks/use-agent-state";

function formatDuration(calledAt: string, now: number): string {
  const ms = now - new Date(calledAt).getTime();
  if (ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function formatAgo(calledAt: string, now: number): string {
  return formatDuration(calledAt, now) + " ago";
}

const PHASE_COLORS: Record<string, string> = {
  ANALYZE: "text-blue-400",
  DESIGN: "text-violet-400",
  PLAN: "text-amber-400",
  IMPLEMENT: "text-emerald-400",
  VALIDATE: "text-cyan-400",
  REVIEW: "text-indigo-400",
  HANDOFF: "text-pink-400",
  DEPLOY: "text-orange-400",
  LISTENING: "text-slate-400",
};

/** AgentNow — upper status card showing current phase and active tool. */
export function AgentNow({ state }: { state: AgentNowState | null }): React.JSX.Element | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

  if (!state) return null;

  const phaseColor = PHASE_COLORS[state.phase] ?? "text-muted";

  return (
    <div
      className="flex flex-col gap-1.5 px-4 py-3 rounded-lg border border-edge bg-surface"
      data-testid="agent-now-card"
    >
      {/* Phase */}
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${phaseColor}`}>
        {state.phase}
      </span>

      {state.idle ? (
        /* Idle state */
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Idle</span>
          {state.currentTool?.calledAt && (
            <span className="text-xs text-muted">
              {formatAgo(state.currentTool.calledAt, now)}
            </span>
          )}
        </div>
      ) : (
        /* Active tool state */
        <div className="flex items-center gap-2">
          <span
            data-testid="agent-now-spinner"
            className="inline-block w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin"
            aria-hidden="true"
          />
          {state.currentTool && (
            <>
              <span className="text-sm font-mono text-foreground">
                {state.currentTool.name}
              </span>
              <span className="text-xs text-muted">
                {formatDuration(state.currentTool.calledAt, now)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
