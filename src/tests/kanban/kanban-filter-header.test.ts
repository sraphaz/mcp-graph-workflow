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
 * Task 11.1.2: Header operacional e filtros — node_987bcb737e46
 * Structural source-inspection tests (no DOM env available in Vitest).
 *
 * AC1: board updates without losing selection state when filters used.
 * AC2: empty filter shows all agents and cards.
 * AC3: mobile responsive — filters wrap without horizontal scroll.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyKanbanFilters, type KanbanFilters, type KanbanFilterItem } from "../../web/dashboard/src/components/kanban/kanban-filter-header.js";

const COMPONENT_PATH = resolve(
  "src/web/dashboard/src/components/kanban/kanban-filter-header.tsx",
);

function source(): string {
  return readFileSync(COMPONENT_PATH, "utf-8");
}

// ── AC1: board updates without losing selection state ─────────────
describe("KanbanFilterHeader — AC1: stateful filter updates", () => {
  it("should manage filter state with useState (structural)", () => {
    const src = source();
    expect(src).toMatch(/useState.*KanbanFilters|KanbanFilters.*useState/s);
  });

  it("should call onFilterChange when a filter changes (structural)", () => {
    const src = source();
    expect(src).toMatch(/onFilterChange/);
  });

  it("should accept agents, statuses, sprint props for filter options (structural)", () => {
    const src = source();
    expect(src).toMatch(/agents[?]?\s*:/);
    expect(src).toMatch(/statuses[?]?\s*:|sprints[?]?\s*:/);
  });

  it("should not reset other filter fields when one filter changes (structural: spread state)", () => {
    const src = source();
    expect(src).toMatch(/\.\.\.filters|\.\.\.prev/);
  });
});

// ── AC2: empty filter shows all — pure filter logic ───────────────
describe("applyKanbanFilters — AC2: empty filter returns all items", () => {
  const items: KanbanFilterItem[] = [
    { id: "1", title: "Task A", agent: "agent-1", status: "in_progress", sprint: "sprint-1" },
    { id: "2", title: "Task B", agent: "agent-2", status: "done", sprint: "sprint-2" },
    { id: "3", title: "Task C", agent: "agent-1", status: "backlog", sprint: "sprint-1" },
  ];

  const emptyFilters: KanbanFilters = { agent: "", status: "", sprint: "", text: "" };

  it("should return all items when all filters are empty", () => {
    const result = applyKanbanFilters(items, emptyFilters);
    expect(result).toHaveLength(3);
  });

  it("should filter by agent when agent filter is set", () => {
    const result = applyKanbanFilters(items, { ...emptyFilters, agent: "agent-1" });
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.agent === "agent-1")).toBe(true);
  });

  it("should filter by status when status filter is set", () => {
    const result = applyKanbanFilters(items, { ...emptyFilters, status: "done" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should filter by sprint when sprint filter is set", () => {
    const result = applyKanbanFilters(items, { ...emptyFilters, sprint: "sprint-1" });
    expect(result).toHaveLength(2);
  });

  it("should filter by text substring in title (case insensitive)", () => {
    const result = applyKanbanFilters(items, { ...emptyFilters, text: "task b" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("should combine multiple filters (AND logic)", () => {
    const result = applyKanbanFilters(items, { agent: "agent-1", status: "in_progress", sprint: "", text: "" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("should return empty array when no items match", () => {
    const result = applyKanbanFilters(items, { ...emptyFilters, agent: "unknown-agent" });
    expect(result).toHaveLength(0);
  });
});

// ── AC3: mobile responsive (no horizontal scroll) ────────────────
describe("KanbanFilterHeader — AC3: responsive layout", () => {
  it("should use flex-wrap or grid for responsive layout (structural)", () => {
    const src = source();
    expect(src).toMatch(/flex-wrap|flex-col|grid-cols|overflow-x-hidden/);
  });

  it("should not use overflow-x-scroll or overflow-x-auto on the container (structural)", () => {
    const src = source();
    expect(src).not.toMatch(/overflow-x-scroll|overflow-x-auto/);
  });

  it("should use responsive breakpoint classes (structural: sm: or md: prefixes)", () => {
    const src = source();
    expect(src).toMatch(/sm:|md:/);
  });
});
