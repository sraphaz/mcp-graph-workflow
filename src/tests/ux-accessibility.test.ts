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
 * Task 11.4.1: Acessibilidade e navegacao (Epic 11.4: Melhorias UX/UI max-pro).
 * node_fa140745f1df
 *
 * AC1: No critical a11y violations — ARIA labels, states, and landmarks.
 * AC2: All main actions reachable by keyboard — visible focus, no keyboard traps.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const KANBAN = resolve(import.meta.dirname, "../../src/web/dashboard/src/components/kanban");
const LAYOUT = resolve(import.meta.dirname, "../../src/web/dashboard/src/components/layout");
const APP = resolve(import.meta.dirname, "../../src/web/dashboard/src/app");

function read(base: string, file: string): string {
  return readFileSync(resolve(base, file), "utf-8");
}

describe("KanbanToolbar — accessibility (AC1)", () => {
  const src = read(KANBAN, "kanban-toolbar.tsx");

  it("should have aria-label on refresh button (not just title)", () => {
    expect(src).toMatch(/aria-label.*[Rr]efresh|[Rr]efresh.*aria-label/);
  });

  it("should have aria-pressed on swimlane toggle buttons", () => {
    expect(src).toMatch(/aria-pressed/);
  });

  it("should communicate suggestions toggle state via aria-pressed or aria-expanded", () => {
    expect(src).toMatch(/aria-(pressed|expanded)/);
  });
});

describe("SidebarGroup — collapsed icon accessibility (AC2)", () => {
  const src = read(LAYOUT, "sidebar-group.tsx");

  it("should have aria-label on collapsed icon-only buttons", () => {
    expect(src).toMatch(/aria-label/);
  });
});

describe("App — accessibility landmarks (AC1)", () => {
  const src = read(APP, "App.tsx");

  it("should have a skip-to-main-content link", () => {
    expect(src).toMatch(/skip.*main|main.*content/i);
  });

  it("should have role=main on primary content area", () => {
    expect(src).toMatch(/role="main"/);
  });
});
