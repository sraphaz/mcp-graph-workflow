/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { proposeSkillFromTrajectory } from "../core/skills/auto-skill-proposer.js";
import { analyzeTrajectory } from "../core/skills/trajectory-analyzer.js";

describe("proposeSkillFromTrajectory", () => {
  const baseInput = {
    taskId: "node_abc123",
    taskTitle: "Optimize SQLite query performance",
    taskDescription: "Improve SQLite query latency in graph store",
    summary: "Discovered N+1 query pattern; added index",
    reasons: ["retries", "discovered"],
    discoveredAt: "2026-04-28T12:00:00.000Z",
  };

  it("emits a proposal with full frontmatter when reasons present", () => {
    const proposal = proposeSkillFromTrajectory(baseInput);

    expect(proposal.draft).toMatch(/^---\n/);
    expect(proposal.draft).toMatch(/\nsource_task: node_abc123\n/);
    expect(proposal.draft).toMatch(/\ndiscovered_at: 2026-04-28T12:00:00\.000Z\n/);
    expect(proposal.draft).toMatch(/\ntriggers:\s*\[retries, discovered\]\n/);
    expect(proposal.draft).toMatch(/\ndomain: sqlite-perf\n/);
    expect(proposal.draft).toMatch(/\nconfidence: 0\.\d+\n/);
    expect(proposal.draft).toMatch(/\n---\n/);
  });

  it("infers source_task from taskId verbatim", () => {
    const proposal = proposeSkillFromTrajectory({ ...baseInput, taskId: "task_xyz999" });
    expect(proposal.draft).toContain("source_task: task_xyz999");
  });

  it("infers domain from task description keywords (sqlite)", () => {
    const p = proposeSkillFromTrajectory({
      ...baseInput,
      taskTitle: "X",
      taskDescription: "Refactor sqlite store transactions",
    });
    expect(p.domain).toBe("sqlite-perf");
  });

  it("infers domain from MCP-related description", () => {
    const p = proposeSkillFromTrajectory({
      ...baseInput,
      taskTitle: "Add MCP tool",
      taskDescription: "Register a new MCP tool wrapper",
    });
    expect(p.domain).toBe("mcp-tools");
  });

  it("falls back to general domain when no keywords match", () => {
    const p = proposeSkillFromTrajectory({
      ...baseInput,
      taskTitle: "Something",
      taskDescription: "A task with no recognizable domain words",
    });
    expect(p.domain).toBe("general");
  });

  it("scales confidence with number of reasons", () => {
    const one = proposeSkillFromTrajectory({ ...baseInput, reasons: ["retries"] });
    const three = proposeSkillFromTrajectory({ ...baseInput, reasons: ["retries", "adr", "discovered"] });
    expect(three.confidence).toBeGreaterThan(one.confidence);
    expect(three.confidence).toBeLessThanOrEqual(0.9);
  });

  it("includes a body section with task summary for human review", () => {
    const p = proposeSkillFromTrajectory(baseInput);
    expect(p.draft).toContain("Discovered N+1 query pattern; added index");
    expect(p.draft).toContain("Optimize SQLite query performance");
  });

  it("uses current time when discoveredAt is omitted", () => {
    const { discoveredAt: _omit, ...without } = baseInput;
    void _omit;
    const p = proposeSkillFromTrajectory(without);
    expect(p.draft).toMatch(/discovered_at: \d{4}-\d{2}-\d{2}T/);
  });
});

describe("auto-skill-proposer — 3 heuristics end-to-end", () => {
  function buildProposalIfTriggered(
    rationale: string,
    cycleTimeMs: number,
    estimateMinutes: number,
    adrCreated: boolean,
  ) {
    const trajectory = analyzeTrajectory({
      cycleTimeMs,
      estimateMinutes,
      adrCreated,
      summary: rationale,
    });
    if (!trajectory.shouldPropose) return null;
    return proposeSkillFromTrajectory({
      taskId: "task-X",
      taskTitle: "Optimize sqlite query",
      taskDescription: "tune sqlite index",
      summary: rationale,
      reasons: trajectory.reasons,
    });
  }

  it("[heuristic 1] retries: cycle_time > 2× estimate produces a valid proposal", () => {
    const proposal = buildProposalIfTriggered("did the work", 90 * 60_000, 30, false);
    expect(proposal).not.toBeNull();
    expect(proposal?.draft).toContain("triggers: [retries]");
    expect(proposal?.draft).toContain("source_task: task-X");
  });

  it("[heuristic 2] adr: adrCreated=true produces a valid proposal", () => {
    const proposal = buildProposalIfTriggered("on time", 10 * 60_000, 30, true);
    expect(proposal).not.toBeNull();
    expect(proposal?.draft).toContain("triggers: [adr]");
    expect(proposal?.draft).toContain("source_task: task-X");
  });

  it("[heuristic 3] discovered: regex match in summary produces a valid proposal", () => {
    const proposal = buildProposalIfTriggered("discovered N+1 query bug", 10 * 60_000, 30, false);
    expect(proposal).not.toBeNull();
    expect(proposal?.draft).toContain("triggers: [discovered]");
    expect(proposal?.draft).toContain("source_task: task-X");
  });

  it("[negative] normal task with no heuristic returns null", () => {
    const proposal = buildProposalIfTriggered("routine update", 10 * 60_000, 30, false);
    expect(proposal).toBeNull();
  });
});
