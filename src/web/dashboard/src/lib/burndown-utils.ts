/**
 * Pure computation utilities for the burndown chart.
 * Extracted from BurndownChart to enable independent unit testing.
 */

import type { FlowSnapshot } from "./types.js";

export interface BurndownChartEntry {
  date: string;
  actual: number;
  ideal: number;
}

/**
 * Compute chart data from a series of flow snapshots.
 *
 * @returns An empty array when `snapshots` is empty.
 */
export function computeBurndownChartData(snapshots: FlowSnapshot[]): BurndownChartEntry[] {
  if (snapshots.length === 0) return [];

  const first = snapshots[0];
  if (!first) return [];

  const total =
    first.backlogCount +
    first.readyCount +
    first.inProgressCount +
    first.blockedCount +
    first.doneCount;

  return snapshots.map((s, i) => {
    const remaining = s.backlogCount + s.readyCount + s.inProgressCount + s.blockedCount;
    const idealRemaining = Math.max(
      0,
      total - (total / Math.max(snapshots.length - 1, 1)) * i,
    );
    return {
      date: s.snapshotDate.slice(5),
      actual: remaining,
      ideal: Math.round(idealRemaining),
    };
  });
}

/**
 * Compute the total remaining work from a snapshot (backlog + ready + in_progress + blocked).
 */
export function computeRemaining(snapshot: FlowSnapshot): number {
  return snapshot.backlogCount + snapshot.readyCount + snapshot.inProgressCount + snapshot.blockedCount;
}
