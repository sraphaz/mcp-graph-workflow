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
