/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 5.2: Detector de deadlock em grafo de locks
 * AC1 — GIVEN 3 agentes em ciclo de espera WHEN detector roda THEN ciclo quebrado abortando o claim mais novo
 * AC2 — GIVEN agente abortado WHEN reinicia claim THEN participa novamente sem estado corrompido
 * AC3 — GIVEN deadlock recorrente no mesmo arquivo WHEN detectado 3x em 1h THEN alerta escalado ao dashboard
 */

import { describe, it, expect } from "vitest";
import {
  detectDeadlock,
  resolveDeadlock,
  recordDeadlockEvent,
  shouldEscalate,
  type LockEdge,
  type DeadlockEvent,
} from "../../core/pipeline/deadlock-detector.js";

/**
 * Build a wait-for graph edge: agentId is waiting for resourceId currently held by holderId.
 */
function edge(agentId: string, resourceId: string, holderId: string, acquiredAt?: string): LockEdge {
  return {
    agentId,
    resourceId,
    holderId,
    acquiredAt: acquiredAt ?? new Date().toISOString(),
  };
}

describe("AC1 — 3-agent cycle broken by aborting newest claim", () => {
  it("should detect a 3-agent cycle", () => {
    // A waits for file1 held by B, B waits for file2 held by C, C waits for file3 held by A
    const edges: LockEdge[] = [
      edge("agent-A", "file1", "agent-B"),
      edge("agent-B", "file2", "agent-C"),
      edge("agent-C", "file3", "agent-A"),
    ];
    const result = detectDeadlock(edges);
    expect(result.hasDeadlock).toBe(true);
    expect(result.cycle).toHaveLength(3);
    expect(result.cycle).toContain("agent-A");
    expect(result.cycle).toContain("agent-B");
    expect(result.cycle).toContain("agent-C");
  });

  it("should not report deadlock when there is no cycle", () => {
    const edges: LockEdge[] = [
      edge("agent-A", "file1", "agent-B"),
      edge("agent-B", "file2", "agent-C"),
      // C does not wait for anyone — no cycle
    ];
    const result = detectDeadlock(edges);
    expect(result.hasDeadlock).toBe(false);
    expect(result.cycle).toHaveLength(0);
  });

  it("should detect a 2-agent cycle", () => {
    const edges: LockEdge[] = [
      edge("agent-X", "fileA", "agent-Y"),
      edge("agent-Y", "fileB", "agent-X"),
    ];
    const result = detectDeadlock(edges);
    expect(result.hasDeadlock).toBe(true);
  });

  it("should abort the newest agent in the cycle", () => {
    const baseTime = new Date("2026-01-01T10:00:00Z").getTime();
    const edges: LockEdge[] = [
      edge("agent-A", "file1", "agent-B", new Date(baseTime).toISOString()),
      edge("agent-B", "file2", "agent-C", new Date(baseTime + 1000).toISOString()),
      edge("agent-C", "file3", "agent-A", new Date(baseTime + 2000).toISOString()), // newest
    ];
    const detection = detectDeadlock(edges);
    expect(detection.hasDeadlock).toBe(true);
    const resolution = resolveDeadlock(detection, edges);
    expect(resolution.abortedAgent).toBe("agent-C");
  });

  it("should include the aborted resource in the resolution result", () => {
    const edges: LockEdge[] = [
      edge("agent-X", "fileA", "agent-Y", new Date("2026-01-01T09:00:00Z").toISOString()),
      edge("agent-Y", "fileB", "agent-X", new Date("2026-01-01T09:05:00Z").toISOString()),
    ];
    const detection = detectDeadlock(edges);
    const resolution = resolveDeadlock(detection, edges);
    expect(resolution.abortedAgent).toBe("agent-Y");
    expect(typeof resolution.releasedResource).toBe("string");
  });
});

describe("AC2 — aborted agent can re-claim without corrupted state", () => {
  it("should mark the aborted agent as cleanly aborted (not corrupt)", () => {
    const edges: LockEdge[] = [
      edge("agent-A", "file1", "agent-B", new Date("2026-01-01T10:00:00Z").toISOString()),
      edge("agent-B", "file2", "agent-A", new Date("2026-01-01T10:01:00Z").toISOString()),
    ];
    const detection = detectDeadlock(edges);
    const resolution = resolveDeadlock(detection, edges);
    expect(resolution.cleanAbort).toBe(true);
  });

  it("should indicate which resource is released so the agent can retry", () => {
    const edges: LockEdge[] = [
      edge("agent-A", "r1", "agent-B", new Date("2026-01-01T10:00:00Z").toISOString()),
      edge("agent-B", "r2", "agent-A", new Date("2026-01-01T10:01:00Z").toISOString()),
    ];
    const detection = detectDeadlock(edges);
    const resolution = resolveDeadlock(detection, edges);
    expect(resolution.releasedResource).toBe("r2"); // agent-B (newest) releases its held resource
  });

  it("should include the surviving cycle members who remain unaffected", () => {
    const edges: LockEdge[] = [
      edge("agent-A", "f1", "agent-B", new Date("2026-01-01T10:00:00Z").toISOString()),
      edge("agent-B", "f2", "agent-C", new Date("2026-01-01T10:00:30Z").toISOString()),
      edge("agent-C", "f3", "agent-A", new Date("2026-01-01T10:01:00Z").toISOString()),
    ];
    const detection = detectDeadlock(edges);
    const resolution = resolveDeadlock(detection, edges);
    expect(resolution.survivingAgents).not.toContain(resolution.abortedAgent);
    expect(resolution.survivingAgents.length).toBeGreaterThanOrEqual(2);
  });

  it("should return a no-op resolution when there is no deadlock", () => {
    const edges: LockEdge[] = [
      edge("agent-A", "f1", "agent-B"),
    ];
    const detection = detectDeadlock(edges);
    expect(detection.hasDeadlock).toBe(false);
    const resolution = resolveDeadlock(detection, edges);
    expect(resolution.abortedAgent).toBeNull();
  });
});

describe("AC3 — recurrent deadlock on same file escalated after 3 detections in 1h", () => {
  it("should not escalate on first detection", () => {
    const resourceId = "hotly-contested-file.ts";
    const now = new Date();
    const events: DeadlockEvent[] = [
      { resourceId, detectedAt: now.toISOString() },
    ];
    expect(shouldEscalate(resourceId, events)).toBe(false);
  });

  it("should escalate when 3 detections occur on the same resource within 1 hour", () => {
    const resourceId = "race-condition-file.ts";
    const now = new Date();
    const events: DeadlockEvent[] = [
      { resourceId, detectedAt: new Date(now.getTime() - 50 * 60 * 1000).toISOString() }, // 50min ago
      { resourceId, detectedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString() }, // 30min ago
      { resourceId, detectedAt: now.toISOString() },
    ];
    expect(shouldEscalate(resourceId, events)).toBe(true);
  });

  it("should not escalate when 3 detections span more than 1 hour", () => {
    const resourceId = "old-file.ts";
    const now = new Date();
    const events: DeadlockEvent[] = [
      { resourceId, detectedAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString() }, // 90min ago (outside window)
      { resourceId, detectedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString() },
      { resourceId, detectedAt: now.toISOString() },
    ];
    expect(shouldEscalate(resourceId, events)).toBe(false);
  });

  it("should only count events for the specific resource", () => {
    const target = "target.ts";
    const other = "other.ts";
    const now = new Date();
    const events: DeadlockEvent[] = [
      { resourceId: other, detectedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString() },
      { resourceId: other, detectedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
      { resourceId: target, detectedAt: now.toISOString() }, // only 1 event for target
    ];
    expect(shouldEscalate(target, events)).toBe(false);
  });

  it("should record a DeadlockEvent with resourceId and timestamp", () => {
    const events: DeadlockEvent[] = [];
    const resolution = {
      abortedAgent: "agent-Z",
      releasedResource: "locked-file.ts",
      cleanAbort: true,
      survivingAgents: ["agent-A"],
    };
    recordDeadlockEvent(events, resolution.releasedResource);
    expect(events).toHaveLength(1);
    expect(events[0].resourceId).toBe("locked-file.ts");
    expect(typeof events[0].detectedAt).toBe("string");
  });
});
