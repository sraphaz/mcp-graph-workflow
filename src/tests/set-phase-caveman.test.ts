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
 * EPIC 8.1 — Caveman Mode: set_phase accepts caveman flag and persists as project setting.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestStore } from "./helpers/test-store.js";
import { setPhaseCore } from "../core/planner/set-phase-core.js";
import type { SqliteStore } from "../core/store/sqlite-store.js";

describe("set_phase caveman mode", () => {
  let store: SqliteStore;
  let cleanup: () => void;

  beforeEach(() => {
    const ctx = createTestStore("caveman-test");
    store = ctx.store;
    cleanup = ctx.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  it("should persist caveman_mode=on when caveman:true", () => {
    // Act
    const result = setPhaseCore(store, { phase: "IMPLEMENT", caveman: true });

    // Assert
    expect(result.ok).toBe(true);
    expect(store.getProjectSetting("caveman_mode")).toBe("on");
  });

  it("should persist caveman_mode=off when caveman:false", () => {
    // Arrange — first enable
    setPhaseCore(store, { phase: "IMPLEMENT", caveman: true });

    // Act — then disable
    setPhaseCore(store, { phase: "IMPLEMENT", caveman: false });

    // Assert
    expect(store.getProjectSetting("caveman_mode")).toBe("off");
  });

  it("should not change caveman_mode when caveman is undefined", () => {
    // Arrange — set caveman on
    setPhaseCore(store, { phase: "IMPLEMENT", caveman: true });

    // Act — call without caveman
    setPhaseCore(store, { phase: "VALIDATE" });

    // Assert — caveman_mode unchanged
    expect(store.getProjectSetting("caveman_mode")).toBe("on");
  });

  it("should include caveman flag in success result", () => {
    // Act
    const result = setPhaseCore(store, { phase: "IMPLEMENT", caveman: true });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.caveman).toBe(true);
    }
  });
});
