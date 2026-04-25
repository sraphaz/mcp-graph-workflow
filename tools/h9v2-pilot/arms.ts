/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Arm runners for the H9v2 pilot.
 * - runMonolithicArm: 1 prompt, returns extracted files.
 * - runDecomposedArm: 5 subtasks, with context-pollination between them
 *   (sibling outputs injected as prior-assistant turns).
 */

import type { OpenRouterClient, ChatMessage } from "./openrouter-client.js";
import { extractFiles, latestPerPath, type ExtractedFile } from "./extract.js";
import type { PilotTask, PilotSubtask } from "./platt-task.js";

export interface ArmRunResult {
  files: ExtractedFile[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  wallClockMs: number;
  rawResponses: string[];
}

const SYSTEM_PROMPT =
  "You are a senior TypeScript engineer. Write precise, type-safe code. " +
  "When asked to output files, output only the code blocks requested — no prose, no explanations.";

export async function runMonolithicArm(
  client: OpenRouterClient,
  model: string,
  task: PilotTask,
): Promise<ArmRunResult> {
  const start = Date.now();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: task.monolithicPrompt },
  ];

  const res = await client.chat({ model, messages, max_tokens: 4000, temperature: 0.2 });

  const files = latestPerPath(extractFiles(res.content));

  return {
    files,
    promptTokens: res.promptTokens,
    completionTokens: res.completionTokens,
    costUsd: res.costUsd,
    wallClockMs: Date.now() - start,
    rawResponses: [res.content],
  };
}

export interface DecomposedArmOptions {
  /**
   * When true, each subtask prompt includes the FULL accumulated output of its
   * `depends_on` siblings as prior assistant turns. This is the
   * "context-pollination simulated" behavior.
   *
   * When false (naive baseline), subtasks only see the prompt text — no
   * sibling output passed through.
   */
  pollinate: boolean;
  /**
   * Optional: cap on total tokens the polluted context may contribute across
   * all previous assistant turns. Truncate-oldest-first if exceeded.
   * Undefined = no cap (matches simulation behavior). Set to test Gate 5.
   */
  contextBudgetTokens?: number;
}

export async function runDecomposedArm(
  client: OpenRouterClient,
  model: string,
  task: PilotTask,
  opts: DecomposedArmOptions,
): Promise<ArmRunResult> {
  const start = Date.now();
  const subtaskOutputs = new Map<string, string>();
  const rawResponses: string[] = [];
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalCost = 0;

  for (const sub of task.subtasks) {
    const messages = buildMessagesForSubtask(sub, task.subtasks, subtaskOutputs, opts);

    const res = await client.chat({ model, messages, max_tokens: 4000, temperature: 0.2 });

    subtaskOutputs.set(sub.id, res.content);
    rawResponses.push(res.content);
    totalPrompt += res.promptTokens;
    totalCompletion += res.completionTokens;
    totalCost += res.costUsd;
  }

  // Final artifact = collection of all files from all subtask responses,
  // latest-version-per-path (T2 supersedes T1 for calibration.ts, T5 for .test.ts)
  const allFiles: ExtractedFile[] = [];
  for (const out of rawResponses) {
    allFiles.push(...extractFiles(out));
  }

  return {
    files: latestPerPath(allFiles),
    promptTokens: totalPrompt,
    completionTokens: totalCompletion,
    costUsd: totalCost,
    wallClockMs: Date.now() - start,
    rawResponses,
  };
}

function buildMessagesForSubtask(
  sub: PilotSubtask,
  allSubs: PilotSubtask[],
  outputs: Map<string, string>,
  opts: DecomposedArmOptions,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (opts.pollinate && sub.dependsOn.length > 0) {
    // Inject ancestors' outputs as assistant turns + user request
    let accumulated = "";
    const orderedAncestors = topoOrderAncestors(sub, allSubs);

    for (const ancestorId of orderedAncestors) {
      const out = outputs.get(ancestorId);
      if (!out) continue;
      const ancestor = allSubs.find((s) => s.id === ancestorId);
      if (!ancestor) continue;

      const chunk = `### Output of sibling ${ancestor.id} (${ancestor.title}):\n${out}`;
      accumulated += (accumulated ? "\n\n" : "") + chunk;
    }

    // Apply budget truncation (oldest-first) if configured
    if (opts.contextBudgetTokens !== undefined) {
      const approxTokens = Math.ceil(accumulated.length / 4);
      if (approxTokens > opts.contextBudgetTokens) {
        const maxChars = opts.contextBudgetTokens * 4;
        accumulated = accumulated.slice(-maxChars); // keep newest tail
      }
    }

    const pollinationBlock = `Here are the outputs produced by predecessor subtasks in this epic. Extend these — do not reinvent modules, imports, or conventions:\n\n${accumulated}`;

    messages.push({ role: "user", content: pollinationBlock });
    messages.push({
      role: "assistant",
      content: "Understood. I will extend the existing code and keep conventions consistent.",
    });
  }

  messages.push({ role: "user", content: sub.prompt });
  return messages;
}

function topoOrderAncestors(sub: PilotSubtask, allSubs: PilotSubtask[]): string[] {
  const ancestors = new Set<string>();
  const stack = [...sub.dependsOn];
  while (stack.length > 0) {
    const id = stack.pop();
    if (!id || ancestors.has(id)) continue;
    ancestors.add(id);
    const ancestor = allSubs.find((s) => s.id === id);
    if (ancestor) stack.push(...ancestor.dependsOn);
  }
  // Sort by position in allSubs array (canonical definition order)
  const orderMap = new Map(allSubs.map((s, i) => [s.id, i]));
  return [...ancestors].sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));
}
