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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { detectCurrentPhase } from "../core/planner/lifecycle-phase.js";
import { makeNode } from "./helpers/factories.js";

describe("set_phase via project settings", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  it("should store phase override in project_settings", () => {
    store.setProjectSetting("lifecycle_phase_override", "HANDOFF");
    expect(store.getProjectSetting("lifecycle_phase_override")).toBe("HANDOFF");
  });

  it("should make detectCurrentPhase return override when set", () => {
    const node = makeNode({ status: "in_progress" });
    store.insertNode(node);
    const doc = store.toGraphDocument();

    // Without override → IMPLEMENT
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");

    // With override → LISTENING
    expect(detectCurrentPhase(doc, { phaseOverride: "LISTENING" })).toBe("LISTENING");
  });

  it("should clear override when set to empty string", () => {
    store.setProjectSetting("lifecycle_phase_override", "HANDOFF");
    store.setProjectSetting("lifecycle_phase_override", "");

    const value = store.getProjectSetting("lifecycle_phase_override");
    expect(value).toBe("");
  });

  it("should use auto-detection when override is empty or null", () => {
    const node = makeNode({ status: "in_progress" });
    store.insertNode(node);
    const doc = store.toGraphDocument();

    // Empty string override should be treated as no override
    expect(detectCurrentPhase(doc, { phaseOverride: null })).toBe("IMPLEMENT");
  });
});

describe("set_phase WIP flags", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  it("should persist wipStrict as wip_strict_mode", () => {
    store.setProjectSetting("wip_strict_mode", "true");
    expect(store.getProjectSetting("wip_strict_mode")).toBe("true");

    store.setProjectSetting("wip_strict_mode", "false");
    expect(store.getProjectSetting("wip_strict_mode")).toBe("false");
  });

  it("should persist maxInFlight as wip_max_in_flight", () => {
    store.setProjectSetting("wip_max_in_flight", "3");
    expect(store.getProjectSetting("wip_max_in_flight")).toBe("3");
  });

  it("should default wip_strict_mode to true when teamTask is enabled", () => {
    store.setProjectSetting("team_task_mode", "on");
    // When teamTask=on and wip_strict_mode not set, default is true
    const teamTaskOn = store.getProjectSetting("team_task_mode") === "on";
    const wipStrictRaw = store.getProjectSetting("wip_strict_mode");
    const wipStrict = wipStrictRaw !== null ? wipStrictRaw === "true" : teamTaskOn;
    expect(wipStrict).toBe(true);
  });

  it("should default wip_strict_mode to false when teamTask is disabled", () => {
    store.setProjectSetting("team_task_mode", "off");
    const teamTaskOn = store.getProjectSetting("team_task_mode") === "on";
    const wipStrictRaw = store.getProjectSetting("wip_strict_mode");
    const wipStrict = wipStrictRaw !== null ? wipStrictRaw === "true" : teamTaskOn;
    expect(wipStrict).toBe(false);
  });
});
