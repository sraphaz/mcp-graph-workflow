/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: StatusBadge — colored status chip
 */

const STATUS_COLORS: Record<string, string> = {
  online: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  active: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  done: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  pass: "bg-emerald-900/40 text-emerald-300 border-emerald-700",
  offline: "bg-red-900/40 text-red-300 border-red-700",
  blocked: "bg-red-900/40 text-red-300 border-red-700",
  fail: "bg-red-900/40 text-red-300 border-red-700",
  error: "bg-red-900/40 text-red-300 border-red-700",
  in_progress: "bg-amber-900/40 text-amber-300 border-amber-700",
  running: "bg-amber-900/40 text-amber-300 border-amber-700",
  ready: "bg-blue-900/40 text-blue-300 border-blue-700",
  backlog: "bg-slate-700/60 text-slate-400 border-slate-600",
  inactive: "bg-slate-700/60 text-slate-400 border-slate-600",
  pending: "bg-slate-700/60 text-slate-400 border-slate-600",
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps): React.JSX.Element {
  const colors = STATUS_COLORS[status] ?? "bg-slate-700/60 text-slate-400 border-slate-600";
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${colors}`}
    >
      {label && <span className="text-inherit opacity-70">{label}:</span>}
      {status}
    </span>
  );
}
