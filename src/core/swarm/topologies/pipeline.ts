/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Sequential pipeline (linear ring): output of stage N becomes input of
 * stage N+1, last stage terminates (does not wrap). Used for TDD handoff
 * Red→Green→Refactor between specialized workers (EPIC 19.T03 / AC2).
 */

import { McpGraphError } from "../../utils/errors.js";

export interface PipelineStageInput {
  role: string;
  agentId: string;
}

export interface PipelineStage {
  role: string;
  agentId: string;
  /** Next stage's agentId, or null if this is the last stage. */
  next: string | null;
}

export type StageExecutor<T> = (stage: PipelineStage, input: T) => Promise<T>;

/** buildPipelineStages — auto-generated description placeholder. */
export function buildPipelineStages(input: PipelineStageInput[]): PipelineStage[] {
  if (input.length === 0) return [];
  const seen = new Set<string>();
  for (const sVar of input) {
    if (seen.has(sVar.agentId)) {
      throw new McpGraphError(`Duplicate agent in pipeline: ${sVar.agentId}`);
    }
    seen.add(sVar.agentId);
  }
  return input.map((s, i) => {
    const peer = i < input.length - 1 ? input[i + 1] : undefined;
    return {
      role: s.role,
      agentId: s.agentId,
      next: peer ? peer.agentId : null,
    };
  });
}

/** getNextStage — auto-generated description placeholder. */
export function getNextStage(
  stages: PipelineStage[],
  currentAgentId: string,
): PipelineStage | null {
  const idx = stages.findIndex((s) => s.agentId === currentAgentId);
  if (idx < 0 || idx === stages.length - 1) return null;
  return stages[idx + 1] ?? null;
}

/** runPipeline — auto-generated description placeholder. */
export async function runPipeline<T>(
  stages: PipelineStage[],
  initialInput: T,
  executor: StageExecutor<T>,
): Promise<T> {
  let payload = initialInput;
  for (const stage of stages) {
    payload = await executor(stage, payload);
  }
  return payload;
}
