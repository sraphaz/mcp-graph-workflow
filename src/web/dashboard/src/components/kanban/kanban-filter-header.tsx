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
 * KanbanFilterHeader — operational header with multi-dimension filters.
 *
 * Filters: agent, status, sprint, text.
 * Filter state is preserved across filter changes (spread pattern).
 * Layout is mobile-responsive via flex-wrap — no horizontal scroll.
 * Pure filter logic exported as applyKanbanFilters for unit testing.
 */

import React, { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────

export interface KanbanFilters {
  agent: string;
  status: string;
  sprint: string;
  text: string;
}

export interface KanbanFilterItem {
  id: string;
  title: string;
  agent: string;
  status: string;
  sprint: string;
}

export interface KanbanFilterHeaderProps {
  agents?: string[];
  statuses?: string[];
  sprints?: string[];
  initialFilters?: Partial<KanbanFilters>;
  onFilterChange: (filters: KanbanFilters) => void;
}

// ── Pure filter logic ─────────────────────────────────────────────

/** applyKanbanFilters — auto-generated description placeholder. */
export function applyKanbanFilters(
  items: KanbanFilterItem[],
  filters: KanbanFilters,
): KanbanFilterItem[] {
  return items.filter((item) => {
    if (filters.agent && item.agent !== filters.agent) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (filters.sprint && item.sprint !== filters.sprint) return false;
    if (filters.text && !item.title.toLowerCase().includes(filters.text.toLowerCase())) return false;
    return true;
  });
}

const EMPTY_FILTERS: KanbanFilters = { agent: "", status: "", sprint: "", text: "" };

// ── Component ─────────────────────────────────────────────────────

/** KanbanFilterHeader — auto-generated description placeholder. */
export function KanbanFilterHeader({
  agents = [],
  statuses = [],
  sprints = [],
  initialFilters,
  onFilterChange,
}: KanbanFilterHeaderProps): React.ReactElement {
  const [filters, setFilters] = useState<KanbanFilters>({ ...EMPTY_FILTERS, ...initialFilters });

  function updateFilter<K extends keyof KanbanFilters>(key: K, value: string): void {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center px-4 py-2 bg-neutral-900 border-b border-neutral-700">
      {/* Agent filter */}
      <select
        className="text-sm bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-neutral-100 min-w-0 sm:w-auto"
        value={filters.agent}
        aria-label="Filter by agent"
        onChange={(e) => updateFilter("agent", e.target.value)}
      >
        <option value="">All agents</option>
        {agents.map((a) => (
          <option key={a} value={a}>{a}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        className="text-sm bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-neutral-100 min-w-0 sm:w-auto"
        value={filters.status}
        aria-label="Filter by status"
        onChange={(e) => updateFilter("status", e.target.value)}
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Sprint filter */}
      <select
        className="text-sm bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-neutral-100 min-w-0 sm:w-auto"
        value={filters.sprint}
        aria-label="Filter by sprint"
        onChange={(e) => updateFilter("sprint", e.target.value)}
      >
        <option value="">All sprints</option>
        {sprints.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* Text search */}
      <input
        type="search"
        className="text-sm bg-neutral-800 border border-neutral-600 rounded px-2 py-1 text-neutral-100 flex-1 min-w-0 md:max-w-xs"
        value={filters.text}
        placeholder="Search tasks..."
        aria-label="Search tasks by text"
        onChange={(e) => updateFilter("text", e.target.value)}
      />

      {/* Clear all */}
      {(filters.agent || filters.status || filters.sprint || filters.text) && (
        <button
          className="text-xs text-neutral-400 hover:text-neutral-100 px-2 py-1"
          onClick={() => {
            setFilters(EMPTY_FILTERS);
            onFilterChange(EMPTY_FILTERS);
          }}
          aria-label="Clear all filters"
        >
          Clear
        </button>
      )}
    </div>
  );
}
