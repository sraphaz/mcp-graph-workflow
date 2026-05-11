/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 3.1: KpiTile — big number + label + optional sparkline
 */

interface KpiTileProps {
  value: string | number;
  label: string;
  sparkline?: number[];
}

function Sparkline({ values }: { values: number[] }): React.JSX.Element | null {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const w = 60;
  const h = 20;
  const step = w / (values.length - 1);
  const points = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      width={w}
      height={h}
      className="opacity-60"
      viewBox={`0 0 ${w} ${h}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KpiTile({ value, label, sparkline }: KpiTileProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-slate-800/60 border border-slate-700">
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums text-slate-100">{value}</span>
        {sparkline && <Sparkline values={sparkline} />}
      </div>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
