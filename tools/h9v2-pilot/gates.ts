/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * H9v2 release gates (ADR-v11-007 + v11-GATE extensions).
 */

import type { ArmMetrics } from "./metrics.js";

export interface GateResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  severity: "required" | "recommended";
}

export interface GatesReport {
  overallPassed: boolean;
  gates: GateResult[];
}

export interface ArmSet {
  /** A baseline: monolithic prompt, smaller model (Haiku). */
  armA: ArmMetrics;
  /** B-v2: decomposed + context-pollination, smaller model (Haiku). */
  armB: ArmMetrics;
  /** C baseline: monolithic prompt, larger model (Sonnet). */
  armC: ArmMetrics;
  /** B-v2 with forced small budget — for Gate 5 stress. */
  armBStressed?: ArmMetrics;
  /** Per-task metrics for generalization Gate 6 (N=5). */
  additionalTasks?: Array<{ taskId: string; armB: ArmMetrics }>;
}

export function evaluateGates(arms: ArmSet): GatesReport {
  const gates: GateResult[] = [];

  // Gate 1 (syntactic): B-v2 tests parse >= 80%
  gates.push({
    id: "gate-1",
    label: "Gate 1 — Syntactic (B-v2 parse rate >= 80%)",
    passed: arms.armB.parseRate >= 0.8,
    detail: `parseRate=${(arms.armB.parseRate * 100).toFixed(1)}% (threshold 80%)`,
    severity: "required",
  });

  // Gate 2 (functional): B-v2 pass rate >= 80% of Sonnet
  const threshold2 = arms.armC.passRate * 0.8;
  gates.push({
    id: "gate-2",
    label: "Gate 2 — Functional (B-v2 pass >= 80% of Sonnet)",
    passed: arms.armB.passRate >= threshold2,
    detail: `B-v2=${(arms.armB.passRate * 100).toFixed(1)}%, threshold=${(threshold2 * 100).toFixed(1)}% (80% of Sonnet ${(arms.armC.passRate * 100).toFixed(1)}%)`,
    severity: "required",
  });

  // Gate 3 (cost): B-v2 cost <= 50% of Sonnet
  const costThreshold = arms.armC.costUsd * 0.5;
  gates.push({
    id: "gate-3",
    label: "Gate 3 — Cost (B-v2 cost <= 50% of Sonnet)",
    passed: arms.armB.costUsd <= costThreshold,
    detail: `B-v2=$${arms.armB.costUsd.toFixed(4)}, threshold=$${costThreshold.toFixed(4)} (50% of Sonnet $${arms.armC.costUsd.toFixed(4)})`,
    severity: "required",
  });

  // Gate 4 (reproduction): B-v2 pass >= 80% of simulation (assumed simulation=1.0)
  // We use 0.8 as absolute floor per the PRD refinements
  gates.push({
    id: "gate-4",
    label: "Gate 4 — Reproduction (B-v2 pass >= 80% absolute)",
    passed: arms.armB.passRate >= 0.8,
    detail: `B-v2 passRate=${(arms.armB.passRate * 100).toFixed(1)}%, threshold=80%`,
    severity: "required",
  });

  // Gate 5 (budget stress): stressed vs unstressed drop < 20%
  if (arms.armBStressed) {
    const drop = arms.armB.passRate - arms.armBStressed.passRate;
    gates.push({
      id: "gate-5",
      label: "Gate 5 — Budget stress (tokenBudget=4000 drop < 20%)",
      passed: drop < 0.2,
      detail: `unstressed=${(arms.armB.passRate * 100).toFixed(1)}%, stressed=${(arms.armBStressed.passRate * 100).toFixed(1)}%, drop=${(drop * 100).toFixed(1)}%`,
      severity: "recommended",
    });
  } else {
    gates.push({
      id: "gate-5",
      label: "Gate 5 — Budget stress",
      passed: false,
      detail: "SKIPPED (armBStressed not provided)",
      severity: "recommended",
    });
  }

  // Gate 6 (generalization): >= 3/5 N=5 tasks show parse >= 80%
  if (arms.additionalTasks && arms.additionalTasks.length > 0) {
    const passing = arms.additionalTasks.filter((t) => t.armB.parseRate >= 0.8).length;
    const total = arms.additionalTasks.length + 1; // include primary Platt task
    const passingWithPrimary = passing + (arms.armB.parseRate >= 0.8 ? 1 : 0);
    const threshold = 3;
    gates.push({
      id: "gate-6",
      label: "Gate 6 — Generalization (>=3/5 tasks parse >=80%)",
      passed: passingWithPrimary >= threshold,
      detail: `${passingWithPrimary}/${total} tasks met threshold`,
      severity: "recommended",
    });
  } else {
    gates.push({
      id: "gate-6",
      label: "Gate 6 — Generalization",
      passed: false,
      detail: "SKIPPED (additionalTasks not provided)",
      severity: "recommended",
    });
  }

  const required = gates.filter((g) => g.severity === "required");
  const overallPassed = required.every((g) => g.passed);

  return { overallPassed, gates };
}
