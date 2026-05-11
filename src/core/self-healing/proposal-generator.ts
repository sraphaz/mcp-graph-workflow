/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-self-healing — Task 2.3: HealingProposal generator + memory persistence.
 *
 * Pure functions: generateHealingProposal (no I/O), writeHealingProposal,
 * readHealingProposals. Writes to memory namespace self_healing_signals/.
 */

import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { generateId } from "../utils/id.js";
import { writeMemory } from "../memory/memory-reader.js";
import {
  HealingProposalSchema,
  type HealingProposal,
  type SuggestedAction,
} from "../../schemas/healing-proposal.schema.js";
import type { FailureSignal } from "../../schemas/failure-signal.schema.js";

const MAX_EVIDENCE = 10;
const OBSERVED_THRESHOLD = 3;
const NAMESPACE = "self_healing_signals";
const STORE_DIR = "workflow-graph";

const PATTERN_ACTIONS: Record<string, SuggestedAction[]> = {
  missing_ac: [
    { kind: "open_issue", description: "Create issue to add acceptance criteria to affected task", autoApplyable: false },
    { kind: "add_pattern_rule", description: "Add rule enforcing AC requirement at task creation", autoApplyable: false },
  ],
  status_skip: [
    { kind: "review_gate_config", description: "Review lifecycle gate config — status transitions may be bypassed", autoApplyable: false },
  ],
  orphan_node: [
    { kind: "check_dependency", description: "Locate parent node and link orphan task to correct epic", autoApplyable: false },
  ],
  missing_estimate: [
    { kind: "review_tool_input", description: "Enforce xpSize or estimateMinutes at task creation", autoApplyable: false },
  ],
  missing_description: [
    { kind: "add_pattern_rule", description: "Add rule requiring non-empty description in task creation", autoApplyable: false },
  ],
  circular_dep: [
    { kind: "review_tool_input", description: "Review and break circular dependency chain", autoApplyable: false },
    { kind: "notify_operator", description: "Notify operator of circular dependency requiring manual resolution", autoApplyable: false },
  ],
  oversized_task: [
    { kind: "decompose_task", description: "Decompose oversized L/XL task into atomic subtasks (≤2h each)", autoApplyable: false },
  ],
};

const DEFAULT_ACTION: SuggestedAction = {
  kind: "notify_operator",
  description: "Inspect pattern and apply manual remediation",
  autoApplyable: false,
};

export function generateHealingProposal(
  pattern: string,
  signals: FailureSignal[],
  windowSeconds: number,
): HealingProposal {
  const signalCount = signals.length;
  const confidence: HealingProposal["confidence"] = signalCount >= OBSERVED_THRESHOLD ? "observed" : "heuristic";
  const evidence = signals.slice(-MAX_EVIDENCE);
  const actions = PATTERN_ACTIONS[pattern] ?? [DEFAULT_ACTION];

  return {
    id: generateId("hp"),
    pattern,
    signalCount,
    windowSeconds,
    evidence,
    suggestedActions: actions,
    confidence,
    createdAt: new Date().toISOString(),
  };
}

export async function writeHealingProposal(basePath: string, proposal: HealingProposal): Promise<void> {
  const safePattern = proposal.pattern.replace(/[^a-zA-Z0-9_-]/g, "_");
  const name = `${NAMESPACE}/${safePattern}-${proposal.id}`;
  const content = [
    `# HealingProposal: ${proposal.pattern}`,
    ``,
    `**id:** ${proposal.id}`,
    `**confidence:** ${proposal.confidence}`,
    `**signalCount:** ${proposal.signalCount}`,
    `**windowSeconds:** ${proposal.windowSeconds}`,
    `**createdAt:** ${proposal.createdAt}`,
    ``,
    `## Suggested Actions`,
    proposal.suggestedActions.map((a) => `- **${a.kind}**: ${a.description}`).join("\n"),
    ``,
    `## Evidence (last ${proposal.evidence.length} signals)`,
    `\`\`\`json`,
    JSON.stringify(proposal.evidence, null, 2),
    `\`\`\``,
    ``,
    `## Raw Proposal`,
    `\`\`\`json`,
    JSON.stringify(proposal, null, 2),
    `\`\`\``,
  ].join("\n");

  await writeMemory(basePath, name, content);
}

export async function readHealingProposals(basePath: string): Promise<HealingProposal[]> {
  const dir = path.join(basePath, STORE_DIR, "memories", NAMESPACE);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const proposals: HealingProposal[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const content = await readFile(path.join(dir, file), "utf-8");
    const jsonMatch = content.match(/## Raw Proposal\s+```json\s+([\s\S]+?)\s+```/);
    if (!jsonMatch) continue;
    const parsed = HealingProposalSchema.safeParse(JSON.parse(jsonMatch[1]!));
    if (parsed.success) {
      proposals.push(parsed.data);
    }
  }
  return proposals;
}
