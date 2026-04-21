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
 * Task 11.2.3: Indicadores de saude operacional — node_1157f1ea4185
 *
 * AC1: with data → metrics (WIP, blocks, at-risk locks, throughput) per agent + global.
 * AC2: no data → explanatory empty state displayed.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  computeHealthMetrics,
  type HealthTask,
} from "../../web/dashboard/src/components/kanban/operational-health-panel.js";

const COMPONENT_PATH = resolve(
  "src/web/dashboard/src/components/kanban/operational-health-panel.tsx",
);

function source(): string {
  return readFileSync(COMPONENT_PATH, "utf-8");
}

const _now = new Date().toISOString();
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
const soonExpiry = new Date(Date.now() + 4 * 60 * 1000).toISOString(); // 4 min from now

const tasks: HealthTask[] = [
  { id: "t1", agent: "agent-1", status: "in_progress", blocked: false },
  { id: "t2", agent: "agent-1", status: "in_progress", blocked: true },
  { id: "t3", agent: "agent-2", status: "in_progress", blocked: false, lockExpiresAt: soonExpiry },
  { id: "t4", agent: "agent-1", status: "done", blocked: false, doneAt: oneHourAgo },
  { id: "t5", agent: "agent-2", status: "done", blocked: false, doneAt: oneDayAgo },
];

// ── AC1: data present → metrics per agent + global ────────────────
describe("computeHealthMetrics — AC1: metrics with data", () => {
  it("should compute WIP per agent", () => {
    const result = computeHealthMetrics(tasks);
    const a1 = result.agents.find((a) => a.agent === "agent-1");
    expect(a1?.wip).toBe(2);
  });

  it("should count blocked tasks per agent", () => {
    const result = computeHealthMetrics(tasks);
    const a1 = result.agents.find((a) => a.agent === "agent-1");
    expect(a1?.blocked).toBe(1);
  });

  it("should count at-risk locks (expiring within 5 minutes)", () => {
    const result = computeHealthMetrics(tasks);
    const a2 = result.agents.find((a) => a.agent === "agent-2");
    expect(a2?.atRiskLocks).toBe(1);
  });

  it("should count recent throughput (done in last 24h)", () => {
    const result = computeHealthMetrics(tasks);
    const a1 = result.agents.find((a) => a.agent === "agent-1");
    expect(a1?.throughput).toBe(1); // t4 done 1h ago (within 24h)
  });

  it("should not count throughput older than 24h", () => {
    const result = computeHealthMetrics(tasks);
    const a2 = result.agents.find((a) => a.agent === "agent-2");
    expect(a2?.throughput).toBe(0); // t5 done 25h ago (outside 24h)
  });

  it("should aggregate global totals", () => {
    const result = computeHealthMetrics(tasks);
    expect(result.global.totalWip).toBe(3);
    expect(result.global.totalBlocked).toBe(1);
    expect(result.global.totalAtRiskLocks).toBe(1);
    expect(result.global.totalThroughput).toBe(1);
  });

  it("should set hasData: true when tasks are provided", () => {
    const result = computeHealthMetrics(tasks);
    expect(result.hasData).toBe(true);
  });
});

// ── AC2: no data → empty state ────────────────────────────────────
describe("computeHealthMetrics + panel — AC2: empty state", () => {
  it("should set hasData: false when no tasks provided", () => {
    const result = computeHealthMetrics([]);
    expect(result.hasData).toBe(false);
  });

  it("should return empty agents array when no tasks", () => {
    const result = computeHealthMetrics([]);
    expect(result.agents).toHaveLength(0);
  });

  it("should show empty state element in panel (structural: empty state present)", () => {
    const src = source();
    expect(src).toMatch(/empty.*state|no.*data|sem.*dados|empty-state/i);
  });

  it("should display OperationalHealthPanel with task prop (structural)", () => {
    const src = source();
    expect(src).toMatch(/OperationalHealthPanel/);
    expect(src).toMatch(/tasks[?]?\s*:/);
  });
});

// ── Component structure ───────────────────────────────────────────
describe("OperationalHealthPanel — component structure", () => {
  it("should show WIP metric in panel (structural)", () => {
    const src = source();
    expect(src).toMatch(/wip|WIP/);
  });

  it("should show blocked indicator in panel (structural)", () => {
    const src = source();
    expect(src).toMatch(/block|bloqueio/i);
  });

  it("should show at-risk locks indicator (structural)", () => {
    const src = source();
    expect(src).toMatch(/atRisk|at-risk|lock.*risk|risk.*lock/i);
  });

  it("should show throughput indicator (structural)", () => {
    const src = source();
    expect(src).toMatch(/throughput|taxa/i);
  });
});
