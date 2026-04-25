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
import { ToolCallLog } from "../core/store/tool-call-log.js";

describe("ToolCallLog.getModeCallCounts — V11 Maestro mode-telemetry", () => {
  let store: SqliteStore;
  let log: ToolCallLog;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    const project = store.initProject("Test Project");
    projectId = project.id;
    log = new ToolCallLog(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("aggregates analyze mode counts from tool_args JSON", () => {
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "decompose" }));
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "implement_done" }));

    const counts = log.getModeCallCounts(projectId, "analyze");
    const byMode = new Map(counts.map((c) => [c.mode, c]));
    expect(byMode.get("ready")?.callCount).toBe(2);
    expect(byMode.get("decompose")?.callCount).toBe(1);
    expect(byMode.get("implement_done")?.callCount).toBe(1);
  });

  it("returns lastCalledAt for each mode", () => {
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    const counts = log.getModeCallCounts(projectId, "analyze");
    expect(counts[0].lastCalledAt).toBeTruthy();
    expect(typeof counts[0].lastCalledAt).toBe("string");
  });

  it("returns empty array for a tool with no calls", () => {
    expect(log.getModeCallCounts(projectId, "analyze")).toEqual([]);
  });

  it("ignores rows whose tool_args has no mode field", () => {
    log.record(projectId, null, "analyze", JSON.stringify({ nodeId: "n1" })); // no mode
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    const counts = log.getModeCallCounts(projectId, "analyze");
    const modes = counts.map((c) => c.mode);
    expect(modes).toEqual(["ready"]);
  });

  it("respects the sinceDays window when provided", () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    store.getDb().prepare(
      `INSERT INTO tool_call_log (project_id, node_id, tool_name, tool_args, called_at)
       VALUES (?, NULL, 'analyze', ?, ?)`,
    ).run(projectId, JSON.stringify({ mode: "old_orphan" }), oldDate);

    log.record(projectId, null, "analyze", JSON.stringify({ mode: "recent" }));

    const last30 = log.getModeCallCounts(projectId, "analyze", 30);
    const modes30 = last30.map((c) => c.mode);
    expect(modes30).toContain("recent");
    expect(modes30).not.toContain("old_orphan");

    const all = log.getModeCallCounts(projectId, "analyze");
    const allModes = all.map((c) => c.mode);
    expect(allModes).toContain("old_orphan");
    expect(allModes).toContain("recent");
  });

  it("isolates by project_id (no cross-project leak)", () => {
    const otherProj = store.initProject("Other Project");

    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    log.record(otherProj.id, null, "analyze", JSON.stringify({ mode: "decompose" }));

    const a = log.getModeCallCounts(projectId, "analyze");
    expect(a.map((c) => c.mode)).toEqual(["ready"]);
    const b = log.getModeCallCounts(otherProj.id, "analyze");
    expect(b.map((c) => c.mode)).toEqual(["decompose"]);
  });

  it("orders by callCount desc (highest-traffic mode first)", () => {
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "decompose" }));

    const counts = log.getModeCallCounts(projectId, "analyze");
    expect(counts[0].mode).toBe("ready");
    expect(counts[0].callCount).toBe(3);
    expect(counts[1].mode).toBe("decompose");
    expect(counts[1].callCount).toBe(1);
  });

  it("surfaces zero-count orphan modes only when explicit candidate list provided", () => {
    log.record(projectId, null, "analyze", JSON.stringify({ mode: "ready" }));

    // Without candidates: only modes that were actually called appear.
    const observed = log.getModeCallCounts(projectId, "analyze");
    expect(observed.map((c) => c.mode)).toEqual(["ready"]);

    // With candidates: zero-count entries are surfaced for unused modes.
    const withOrphans = log.getModeCallCounts(projectId, "analyze", undefined, [
      "ready",
      "cfd",
      "code_sync",
      "economy_simulation",
    ]);
    const byMode = new Map(withOrphans.map((c) => [c.mode, c]));
    expect(byMode.get("ready")?.callCount).toBe(1);
    expect(byMode.get("cfd")?.callCount).toBe(0);
    expect(byMode.get("code_sync")?.callCount).toBe(0);
    expect(byMode.get("economy_simulation")?.callCount).toBe(0);
    expect(byMode.get("cfd")?.lastCalledAt).toBeNull();
  });
});
