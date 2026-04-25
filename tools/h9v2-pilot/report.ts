/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Generate BENCHMARK-v11.md from H9v2 pilot results.
 */

import type { ArmMetrics } from "./metrics.js";
import type { GatesReport, ArmSet } from "./gates.js";

export function renderReport(arms: ArmSet, report: GatesReport, designHash: string): string {
  const lines: string[] = [];
  lines.push("# BENCHMARK v11 — Context-Pollination Engine");
  lines.push("");
  lines.push(`**DesignHash:** \`${designHash}\`  `);
  lines.push(`**Generated:** ${new Date().toISOString()}  `);
  lines.push(`**Overall:** ${report.overallPassed ? "✅ PASS (all required gates met)" : "❌ FAIL (one or more required gates failed)"}`);
  lines.push("");
  lines.push("## Arms");
  lines.push("");
  lines.push("| Arm | Model | Files | Tests | Parse | Pass | Cost USD | Wall ms |");
  lines.push("|---|---|---|---|---|---|---|---|");
  lines.push(armRow("A (mono)", arms.armA));
  lines.push(armRow("B-v2 (decomp + pollination)", arms.armB));
  lines.push(armRow("C (mono Sonnet)", arms.armC));
  if (arms.armBStressed) {
    lines.push(armRow("B-v2-stressed (budget 4000)", arms.armBStressed));
  }
  lines.push("");
  lines.push("## Gates");
  lines.push("");
  lines.push("| Gate | Status | Severity | Detail |");
  lines.push("|---|---|---|---|");
  for (const g of report.gates) {
    lines.push(
      `| ${g.label} | ${g.passed ? "✅" : "❌"} | ${g.severity} | ${g.detail} |`,
    );
  }
  lines.push("");
  if (arms.additionalTasks && arms.additionalTasks.length > 0) {
    lines.push("## Generalization (N=5 corpus)");
    lines.push("");
    lines.push("| Task | Files | Tests | Parse | Pass | Cost USD |");
    lines.push("|---|---|---|---|---|---|");
    for (const t of arms.additionalTasks) {
      lines.push(
        `| ${t.taskId} | ${t.armB.filesExtracted} | ${t.armB.testRun.totalTests} | ${pct(t.armB.parseRate)} | ${pct(t.armB.passRate)} | $${t.armB.costUsd.toFixed(4)} |`,
      );
    }
    lines.push("");
  }
  lines.push("## Interpretation");
  lines.push("");
  lines.push(interpretation(arms, report));
  lines.push("");
  lines.push("## Recommendation");
  lines.push("");
  lines.push(recommendation(arms, report));
  return lines.join("\n");
}

function armRow(label: string, m: ArmMetrics): string {
  return `| ${label} | ${m.modelUsed} | ${m.filesExtracted} | ${m.testRun.totalTests} | ${pct(m.parseRate)} | ${pct(m.passRate)} | $${m.costUsd.toFixed(4)} | ${m.wallClockMs} |`;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function interpretation(_arms: ArmSet, report: GatesReport): string {
  const gate1 = report.gates.find((g) => g.id === "gate-1");
  const gate2 = report.gates.find((g) => g.id === "gate-2");
  const gate3 = report.gates.find((g) => g.id === "gate-3");

  if (gate1?.passed && gate2?.passed && gate3?.passed) {
    return (
      "All three structural gates passed. Context-pollination eliminates both " +
      "structural bugs (parse) and functional bugs (pass) while keeping cost under " +
      "50% of Sonnet baseline."
    );
  }
  if (gate1?.passed && !gate2?.passed) {
    return (
      "Gate 1 (structural) passed but Gate 2 (functional) failed. " +
      "Context-pollination eliminates parsing/import/convention bugs but does not " +
      "fix algorithmic bugs in the underlying model. This is consistent with ADR-v11-007 " +
      "(release gates structural, not algorithmic)."
    );
  }
  if (!gate1?.passed) {
    return (
      "Gate 1 failed — tests did not parse even with context-pollination. " +
      "Investigate: dependency sort wrong? Token budget insufficient? " +
      "LLM output format drifted from expected fence conventions?"
    );
  }
  return "Mixed results — see per-gate details above.";
}

function recommendation(_arms: ArmSet, report: GatesReport): string {
  if (report.overallPassed) {
    return (
      "**Ship 11.0.0 GA.** All required gates met. " +
      "Consider enabling context-pollination by default in CLAUDE.md for decomposed L/XL tasks."
    );
  }
  const failedRequired = report.gates
    .filter((g) => g.severity === "required" && !g.passed)
    .map((g) => g.label);
  return (
    `**Do NOT ship 11.0.0 GA yet.** Failed required gates: ${failedRequired.join(", ")}. ` +
    "Release as 11.0.0-beta with caveats documented, or iterate on the assembly/budget " +
    "parameters before retrying."
  );
}
