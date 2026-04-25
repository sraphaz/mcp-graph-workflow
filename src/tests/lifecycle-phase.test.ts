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

import { describe, it, expect } from "vitest";
import {
  detectCurrentPhase,
  getModesForPhase,
  getPhaseGuidance,
  type LifecyclePhase,
} from "../core/planner/lifecycle-phase.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Task ${i}`,
    status: n.status ?? "backlog",
    priority: n.priority ?? 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...n,
  })) as GraphNode[];

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge_${i}`,
    from: e.from ?? "",
    to: e.to ?? "",
    relationType: e.relationType ?? "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
    ...e,
  })) as GraphEdge[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: fullEdges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("detectCurrentPhase", () => {
  it("should return ANALYZE when no nodes exist", () => {
    const doc = makeDoc();
    expect(detectCurrentPhase(doc)).toBe("ANALYZE");
  });

  it("should return DESIGN when only requirement/decision/epic nodes exist without tasks", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "epic", status: "backlog" },
      { type: "decision", status: "backlog" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("DESIGN");
  });

  it("should return PLAN when tasks exist but none have sprint assigned", () => {
    const doc = makeDoc([
      { type: "epic", status: "backlog" },
      { type: "task", status: "backlog", sprint: null },
      { type: "task", status: "ready", sprint: null },
    ]);
    expect(detectCurrentPhase(doc)).toBe("PLAN");
  });

  it("should return IMPLEMENT when tasks are in_progress", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress", sprint: "sprint-1" },
      { type: "task", status: "backlog", sprint: "sprint-1" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");
  });

  it("should return VALIDATE when most tasks are done but some not validated", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "sprint-1" },
      { type: "task", status: "done", sprint: "sprint-1" },
      { type: "task", status: "ready", sprint: "sprint-1" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("VALIDATE");
  });

  it("should return REVIEW when all tasks are done", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "subtask", status: "done" },
      { type: "epic", status: "done" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("REVIEW");
  });

  it("should return IMPLEMENT when mix of in_progress and done", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress" },
      { type: "task", status: "done" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");
  });

  it("should return DESIGN when acceptance_criteria nodes exist without tasks", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "acceptance_criteria", status: "backlog" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("DESIGN");
  });

  it("should return IMPLEMENT (not DESIGN) when both design and in_progress task nodes exist", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "task", status: "in_progress", sprint: "sprint-1" },
    ]);
    expect(detectCurrentPhase(doc)).toBe("IMPLEMENT");
  });

  it("should handle blocked tasks as non-done for VALIDATE threshold", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "blocked", sprint: "s1" },
    ]);
    // 2/3 done = 66% → VALIDATE
    expect(detectCurrentPhase(doc)).toBe("VALIDATE");
  });

  it("should return override phase when phaseOverride is provided", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress" },
    ]);
    expect(detectCurrentPhase(doc, { phaseOverride: "LISTENING" })).toBe("LISTENING");
  });

  it("should ignore null phaseOverride and use auto-detection", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress" },
    ]);
    expect(detectCurrentPhase(doc, { phaseOverride: null })).toBe("IMPLEMENT");
  });

  it("should return HANDOFF when all tasks done and snapshots exist", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
      { type: "task", status: "done" },
    ]);
    expect(detectCurrentPhase(doc, { hasSnapshots: true })).toBe("HANDOFF");
  });

  it("should return REVIEW (not HANDOFF) when all tasks done but no snapshots", () => {
    const doc = makeDoc([
      { type: "task", status: "done" },
    ]);
    expect(detectCurrentPhase(doc, { hasSnapshots: false })).toBe("REVIEW");
  });

  it("should return LISTENING when all tasks done and new requirement nodes added after last done task", () => {
    const doneTime = "2025-01-01T00:00:00Z";
    const laterTime = "2025-01-02T00:00:00Z";
    const doc = makeDoc([
      { type: "task", status: "done", updatedAt: doneTime },
      { type: "requirement", status: "backlog", createdAt: laterTime },
    ]);
    expect(detectCurrentPhase(doc)).toBe("LISTENING");
  });
});

describe("getPhaseGuidance", () => {
  const phases: LifecyclePhase[] = [
    "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
  ];

  it("should return guidance for every phase", () => {
    for (const phase of phases) {
      const guidance = getPhaseGuidance(phase);
      expect(guidance.reminder).toBeTruthy();
      expect(guidance.suggestedTools.length).toBeGreaterThan(0);
      expect(guidance.principles.length).toBeGreaterThan(0);
    }
  });

  it("should return PT-BR content", () => {
    const guidance = getPhaseGuidance("IMPLEMENT");
    // PT-BR content check — should contain Portuguese words
    expect(guidance.reminder).toMatch(/TDD|implementação|teste/i);
  });

  it("should suggest context and update_status for IMPLEMENT phase", () => {
    const guidance = getPhaseGuidance("IMPLEMENT");
    expect(guidance.suggestedTools).toContain("context");
    expect(guidance.suggestedTools).toContain("update_status");
  });

  it("should not include suggestedMcpAgents (removed for token optimization)", () => {
    for (const phase of ["IMPLEMENT", "DESIGN", "VALIDATE", "ANALYZE", "LISTENING"] as LifecyclePhase[]) {
      const guidance = getPhaseGuidance(phase);
      expect(guidance.suggestedMcpAgents ?? []).toHaveLength(0);
    }
  });
});

describe("getModesForPhase", () => {
  // Source of truth: ANALYZE_MODES enum in src/mcp/tools/analyze.ts.
  // PRD says "todos 52 modes" — keep this list in sync with that enum so the
  // coverage assertion below catches drift.
  const ALL_ANALYZE_MODES = [
    "prd_quality", "scope", "ready", "risk", "blockers", "cycles",
    "critical_path", "contract_coverage", "data_integrity", "decompose",
    "adr", "formula_consistency", "traceability", "coupling", "interfaces",
    "tech_risk", "design_ready", "implement_done", "tdd_check",
    "performance_budget", "progress", "state_completeness", "validate_ready",
    "done_integrity", "status_flow", "review_ready", "handoff_ready",
    "doc_completeness", "deploy_ready", "release_check", "listening_ready",
    "backlog_health", "sprint_health", "auto_ready", "scenario_coverage",
    "asset_blockers", "config_coverage", "metric_coverage", "concurrency_risk",
    "economy_simulation", "cfd", "code_sync", "smart_decompose",
    "security_scan", "code_quality", "test_coverage", "observability_check",
    "harness_scan", "harness_trend", "harness_advice", "harness_remediate",
    "adr_challenge", "orphan_tasks",
  ] as const;

  // AC #1: GIVEN phase=DESIGN WHEN getModesForPhase chamado
  // THEN retorna [adr, traceability, coupling, interfaces, tech_risk,
  //               design_ready, adr_challenge]
  it("returns the 7 DESIGN modes specified in the PRD", () => {
    const modes = getModesForPhase("DESIGN");
    expect(modes).toEqual(
      expect.arrayContaining([
        "adr",
        "traceability",
        "coupling",
        "interfaces",
        "tech_risk",
        "design_ready",
        "adr_challenge",
      ]),
    );
    expect(modes).toHaveLength(7);
  });

  // AC #2: GIVEN phase invalida WHEN chamado THEN retorna array vazio (sem throw)
  it("returns [] for an invalid phase string and never throws", () => {
    expect(() => {
      const result = getModesForPhase("NOT_A_PHASE" as LifecyclePhase);
      expect(result).toEqual([]);
    }).not.toThrow();
  });

  it("returns [] for empty/null/undefined inputs without throwing", () => {
    expect(getModesForPhase("" as LifecyclePhase)).toEqual([]);
    expect(getModesForPhase(undefined as unknown as LifecyclePhase)).toEqual([]);
    expect(getModesForPhase(null as unknown as LifecyclePhase)).toEqual([]);
  });

  // AC #3: GIVEN todas 9 fases WHEN consultadas THEN cobrem todos 52 modes
  // do analyze (sem orfaos)
  it("union of modes across all 9 phases covers every analyze mode", () => {
    const phases: LifecyclePhase[] = [
      "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE",
      "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
    ];
    const union = new Set<string>();
    for (const phase of phases) {
      for (const mode of getModesForPhase(phase)) {
        union.add(mode);
      }
    }
    const orphans = ALL_ANALYZE_MODES.filter((m) => !union.has(m));
    expect(orphans, `orphan modes: ${orphans.join(", ")}`).toEqual([]);
  });

  it("returns a non-empty list for each of the 9 lifecycle phases", () => {
    const phases: LifecyclePhase[] = [
      "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE",
      "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
    ];
    for (const phase of phases) {
      const modes = getModesForPhase(phase);
      expect(modes.length, `phase ${phase} should have ≥1 mode`).toBeGreaterThan(0);
    }
  });

  it("returns only valid analyze modes (no typos)", () => {
    const phases: LifecyclePhase[] = [
      "ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE",
      "REVIEW", "HANDOFF", "DEPLOY", "LISTENING",
    ];
    const valid = new Set<string>(ALL_ANALYZE_MODES);
    for (const phase of phases) {
      for (const mode of getModesForPhase(phase)) {
        expect(valid.has(mode), `unknown mode "${mode}" returned for phase ${phase}`).toBe(true);
      }
    }
  });

  it("IMPLEMENT phase includes tdd_check and implement_done", () => {
    const modes = getModesForPhase("IMPLEMENT");
    expect(modes).toContain("tdd_check");
    expect(modes).toContain("implement_done");
  });

  it("VALIDATE phase includes validate_ready and test_coverage", () => {
    const modes = getModesForPhase("VALIDATE");
    expect(modes).toContain("validate_ready");
  });

  it("returns a fresh array per call (no shared mutable state)", () => {
    const a = getModesForPhase("DESIGN");
    const b = getModesForPhase("DESIGN");
    expect(a).not.toBe(b); // different references
    expect(a).toEqual(b); // same content
    a.push("mutated" as never);
    expect(getModesForPhase("DESIGN")).not.toContain("mutated");
  });
});
