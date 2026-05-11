/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: TimelineItem — reusable timeline row
 * Used in: Trail, Journey, Browser Tests
 */

type OutcomeVariant = "pass" | "fail" | "error" | "running" | "pending";

const OUTCOME_COLORS: Record<OutcomeVariant, string> = {
  pass: "bg-emerald-900/40 text-emerald-300",
  fail: "bg-red-900/40 text-red-300",
  error: "bg-red-900/40 text-red-300",
  running: "bg-amber-900/40 text-amber-300",
  pending: "bg-slate-700/60 text-slate-400",
};

interface TimelineItemProps {
  label: string;
  timestamp?: string | number;
  outcome?: OutcomeVariant;
  children?: React.ReactNode;
}

export function TimelineItem({ label, timestamp, outcome, children }: TimelineItemProps): React.JSX.Element {
  const ts = typeof timestamp === "number"
    ? new Date(timestamp).toISOString().slice(11, 23)
    : timestamp;

  return (
    <li className="flex flex-col gap-1 py-2 border-b border-slate-800/60 last:border-0">
      <div className="flex items-center gap-3">
        {ts && (
          <span className="text-[10px] font-mono text-slate-500 tabular-nums shrink-0">{ts}</span>
        )}
        <span className="text-xs font-mono text-slate-200 flex-1 truncate">{label}</span>
        {outcome && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${OUTCOME_COLORS[outcome]}`}>
            {outcome}
          </span>
        )}
      </div>
      {children && (
        <div className="pl-3 text-xs text-slate-400">{children}</div>
      )}
    </li>
  );
}
