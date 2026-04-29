/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T10 — session-end snapshot tests.
 */

import { describe, it, expect } from "vitest";
import {
  buildSnapshotPayload,
  snapshotFilename,
  selectSnapshotsToPrune,
  isSessionSnapshotDisabled,
  SNAPSHOT_RETENTION,
} from "../core/hooks/session-end-snapshot.js";

const START = Date.parse("2026-04-29T08:00:00Z");
const END = Date.parse("2026-04-29T09:30:00Z");

describe("session-end-snapshot (E21.T10)", () => {
  it("SNAPSHOT_RETENTION = 30", () => {
    expect(SNAPSHOT_RETENTION).toBe(30);
  });

  it("buildSnapshotPayload includes schemaVersion + computed durationMs", () => {
    const p = buildSnapshotPayload({
      sessionId: "s1",
      startedAtMs: START,
      endedAtMs: END,
      costUsd: 1.42,
      tasksStarted: 5,
      tasksDone: 4,
      nodeCountsByStatus: { ready: 3, in_progress: 1, done: 12 },
      harness: { score: 81.7, grade: "B" },
    });
    expect(p.schemaVersion).toBe(1);
    expect(p.sessionId).toBe("s1");
    expect(p.durationMs).toBe(END - START);
    expect(p.costUsd).toBe(1.42);
    expect(p.tasksStarted).toBe(5);
    expect(p.tasksDone).toBe(4);
    expect(p.harness).toEqual({ score: 81.7, grade: "B" });
    expect(p.nodeCountsByStatus.done).toBe(12);
  });

  it("buildSnapshotPayload clamps negative duration to 0", () => {
    const p = buildSnapshotPayload({
      sessionId: "s1",
      startedAtMs: END,
      endedAtMs: START,
      costUsd: 0,
      tasksStarted: 0,
      tasksDone: 0,
      nodeCountsByStatus: {},
      harness: { score: 0, grade: "D" },
    });
    expect(p.durationMs).toBe(0);
  });

  it("snapshotFilename uses ISO timestamp + sessionId", () => {
    const name = snapshotFilename("abc123", END);
    expect(name.startsWith("session-")).toBe(true);
    expect(name.endsWith("-abc123.json")).toBe(true);
    const base = name.replace(/\.json$/, "");
    expect(base).not.toMatch(/[:.]/); // colons/dots in timestamp replaced
  });

  it("selectSnapshotsToPrune returns [] when count <= retention", () => {
    const files = Array.from({ length: 10 }, (_, i) => `session-2026-04-${10 + i}.json`);
    expect(selectSnapshotsToPrune(files, 30)).toEqual([]);
  });

  it("selectSnapshotsToPrune returns oldest surplus when count > retention", () => {
    const files = Array.from({ length: 35 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `session-2026-04-${day}.json`;
    });
    const pruned = selectSnapshotsToPrune(files, 30);
    expect(pruned).toHaveLength(5);
    expect(pruned[0]).toBe("session-2026-04-01.json");
    expect(pruned[4]).toBe("session-2026-04-05.json");
  });

  it("selectSnapshotsToPrune ignores non-snapshot files", () => {
    const files = ["README.md", "session-a.json", "session-b.json", "other.json"];
    const pruned = selectSnapshotsToPrune(files, 1);
    expect(pruned).toEqual(["session-a.json"]);
  });

  it("isSessionSnapshotDisabled respects env", () => {
    expect(isSessionSnapshotDisabled({ MCP_GRAPH_SESSION_SNAPSHOT: "off" })).toBe(true);
    expect(isSessionSnapshotDisabled({})).toBe(false);
  });
});
