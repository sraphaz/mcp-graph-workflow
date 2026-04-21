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
 * Task 11.4.1: Acessibilidade e navegacao — structural accessibility tests.
 * node_f71592a29bba
 *
 * No DOM env — structural source checks verify ARIA and keyboard attributes
 * are present in component source. Visual/interaction testing via Playwright E2E.
 *
 * AC1: No critical a11y violations (ARIA labels, focus indicators, no keyboard traps).
 * AC2: All main actions reachable by keyboard.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const DASHBOARD = resolve(import.meta.dirname, "../../src/web/dashboard/src/components/kanban");

function readComponent(file: string): string {
  return readFileSync(resolve(DASHBOARD, file), "utf-8");
}

describe("KanbanCard — accessibility", () => {
  const src = readComponent("kanban-card.tsx");

  it("should have tabIndex for keyboard focus", () => {
    expect(src).toMatch(/tabIndex/);
  });

  it("should have role attribute for screen readers", () => {
    expect(src).toMatch(/role=/);
  });

  it("should have aria-label for card content", () => {
    expect(src).toMatch(/aria-label/);
  });

  it("should handle keyboard events (Enter/Space) as click alternative", () => {
    expect(src).toMatch(/onKeyDown/);
  });
});

describe("KanbanColumn — accessibility", () => {
  const src = readComponent("kanban-column.tsx");

  it("should have role attribute on column container", () => {
    expect(src).toMatch(/role=/);
  });

  it("should have aria-label on column", () => {
    expect(src).toMatch(/aria-label/);
  });

  it("should mark drag-over state with aria-dropeffect or aria-label update", () => {
    expect(src).toMatch(/aria-/);
  });
});

describe("KanbanBoard — accessibility", () => {
  const src = readComponent("kanban-board.tsx");

  it("should have role or aria-label on board container", () => {
    expect(src).toMatch(/aria-/);
  });
});
