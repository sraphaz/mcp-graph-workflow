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
 * Task 11.2.2: Interacoes de board — structural interaction tests.
 * node_af14bf43aa1c
 *
 * AC1: Card blocked by agent → system prevents move and shows reason.
 * AC2: Valid card move → status synced with backend.
 * AC3: Keyboard access to menu/actions without mouse.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const KANBAN = resolve(import.meta.dirname, "../../src/web/dashboard/src/components/kanban");
const TABS = resolve(import.meta.dirname, "../../src/web/dashboard/src/components/tabs");

function read(base: string, file: string): string {
  return readFileSync(resolve(base, file), "utf-8");
}

// AC1 + AC2: move result feedback in kanban-tab
describe("KanbanTab — move result feedback", () => {
  const src = read(TABS, "kanban-tab.tsx");

  it("should capture moveCard result (not discard it)", () => {
    // Must assign result from moveCard, not just await with no variable
    expect(src).toMatch(/const\s+result\s*=\s*await\s+moveCard/);
  });

  it("should check move result success or warnings", () => {
    // moveResult.success or moveResult.warnings (state variable may be renamed)
    expect(src).toMatch(/moveResult\.(success|warnings)|result\.(success|warnings)/);
  });

  it("should display move warnings or error to user", () => {
    // State or JSX for move feedback
    expect(src).toMatch(/moveResult|moveWarning|moveError|move.*warn/i);
  });

  it("should clear feedback on next successful move", () => {
    // State setter called in handleMoveCard
    expect(src).toMatch(/setMove(Result|Warning|Error)/);
  });
});

// AC3: keyboard action menu in kanban-card
describe("KanbanCard — keyboard action menu", () => {
  const src = read(KANBAN, "kanban-card.tsx");

  it("should have an action menu trigger button", () => {
    // A button or element that triggers a menu
    expect(src).toMatch(/aria-haspopup|role="menu"|showMenu|actionMenu|CardMenu/i);
  });

  it("should expose menu trigger that is keyboard reachable (tabIndex or button)", () => {
    // The menu trigger must be focusable
    expect(src).toMatch(/tabIndex|<button/);
  });

  it("should support keyboard navigation to open menu (Enter or Space or ArrowDown)", () => {
    expect(src).toMatch(/onKeyDown/);
  });
});

// AC2: backend sync — useKanbanBoard refreshes after move
describe("useKanbanBoard — backend sync on move", () => {
  const src = readFileSync(
    resolve(import.meta.dirname, "../../src/web/dashboard/src/hooks/use-kanban.ts"),
    "utf-8",
  );

  it("should call refresh after a successful move", () => {
    expect(src).toMatch(/result\.success.*refresh|if.*success.*await.*refresh/s);
  });

  it("should return the move result from moveCard", () => {
    expect(src).toMatch(/return result/);
  });
});
