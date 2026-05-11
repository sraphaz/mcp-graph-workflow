/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 2.3: HealingProposal para host
 *
 * AC1: GIVEN classified pattern WHEN proposal generated THEN includes ≥1 suggestedAction
 * AC2: GIVEN confidence WHEN inspected THEN ∈ {observed, heuristic}
 * AC3: GIVEN proposal WHEN written THEN appears in read_memory({namespace:"self_healing_signals"})
 */

import { describe, it, expect } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import {
  HealingProposalSchema,
  type HealingProposal,
} from "../schemas/healing-proposal.schema.js";
import {
  generateHealingProposal,
  writeHealingProposal,
  readHealingProposals,
} from "../core/self-healing/proposal-generator.js";
import type { FailureSignal } from "../schemas/failure-signal.schema.js";

function makeSignal(source: FailureSignal["source"] = "tool_invocation"): FailureSignal {
  return {
    source,
    signalKind: "missing_ac",
    context: { toolName: "finish_task" },
    severity: "warn",
    timestamp: new Date().toISOString(),
  };
}

// ── Schema validation ─────────────────────────────────────────────────────

describe("HealingProposalSchema", () => {
  it("parses a valid proposal", () => {
    const raw: HealingProposal = {
      id: "hp-1",
      pattern: "missing_ac",
      signalCount: 5,
      windowSeconds: 300,
      evidence: [makeSignal()],
      suggestedActions: [
        { kind: "open_issue", description: "Create AC issue", autoApplyable: false },
      ],
      confidence: "observed",
      createdAt: new Date().toISOString(),
    };
    const result = HealingProposalSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("AC2: confidence must be observed or heuristic — rejects unknown value", () => {
    const result = HealingProposalSchema.safeParse({
      id: "hp-x",
      pattern: "missing_ac",
      signalCount: 1,
      windowSeconds: 60,
      evidence: [],
      suggestedActions: [{ kind: "open_issue", description: "x", autoApplyable: false }],
      confidence: "inferred", // forbidden
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

// ── generateHealingProposal ───────────────────────────────────────────────

describe("generateHealingProposal", () => {
  it("AC1: returns proposal with ≥1 suggestedAction", () => {
    const signals = [makeSignal(), makeSignal(), makeSignal()];
    const proposal = generateHealingProposal("missing_ac", signals, 300);
    expect(proposal.suggestedActions.length).toBeGreaterThanOrEqual(1);
  });

  it("AC1: suggestedAction.autoApplyable is always false (MVP)", () => {
    const signals = [makeSignal()];
    const proposal = generateHealingProposal("missing_ac", signals, 60);
    for (const action of proposal.suggestedActions) {
      expect(action.autoApplyable).toBe(false);
    }
  });

  it("AC2: confidence is observed when signalCount ≥ 3", () => {
    const signals = Array.from({ length: 5 }, () => makeSignal());
    const proposal = generateHealingProposal("missing_ac", signals, 300);
    expect(proposal.confidence).toBe("observed");
  });

  it("AC2: confidence is heuristic when signalCount < 3", () => {
    const signals = [makeSignal()];
    const proposal = generateHealingProposal("missing_ac", signals, 300);
    expect(proposal.confidence).toBe("heuristic");
  });

  it("AC2: confidence is never inferred", () => {
    const signals = [makeSignal()];
    const proposal = generateHealingProposal("status_skip", signals, 60);
    expect(["observed", "heuristic"]).toContain(proposal.confidence);
  });

  it("sets signalCount and windowSeconds from inputs", () => {
    const signals = [makeSignal(), makeSignal()];
    const proposal = generateHealingProposal("orphan_node", signals, 120);
    expect(proposal.signalCount).toBe(2);
    expect(proposal.windowSeconds).toBe(120);
    expect(proposal.pattern).toBe("orphan_node");
  });

  it("includes evidence from signals (up to last 10)", () => {
    const signals = Array.from({ length: 15 }, () => makeSignal());
    const proposal = generateHealingProposal("missing_ac", signals, 300);
    expect(proposal.evidence.length).toBeLessThanOrEqual(10);
    expect(proposal.evidence.length).toBeGreaterThan(0);
  });
});

// ── writeHealingProposal / readHealingProposals ───────────────────────────

describe("writeHealingProposal + readHealingProposals (AC3)", () => {
  it("AC3: written proposal appears in read under self_healing_signals namespace", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "healing-"));

    const signals = [makeSignal(), makeSignal(), makeSignal()];
    const proposal = generateHealingProposal("missing_ac", signals, 300);

    await writeHealingProposal(tmpDir, proposal);

    const found = await readHealingProposals(tmpDir);
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(found.some((p: HealingProposal) => p.id === proposal.id)).toBe(true);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("AC3: memory name is under self_healing_signals/ subdirectory", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "healing-ns-"));

    const signals = [makeSignal()];
    const proposal = generateHealingProposal("status_skip", signals, 60);
    await writeHealingProposal(tmpDir, proposal);

    // Memory files must be under workflow-graph/memories/self_healing_signals/
    const memoriesDir = path.join(tmpDir, "workflow-graph", "memories", "self_healing_signals");
    const entries = await fs.readdir(memoriesDir).catch(() => [] as string[]);
    expect(entries.some((f) => f.endsWith(".md"))).toBe(true);

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
