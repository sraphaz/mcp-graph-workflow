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
 * Tool Pipeline — zero-context-cost sequential tool chain execution.
 * Results never enter LLM conversation context — only final summary returned.
 * Each step is traced as a span. Partial results on failure.
 * Inspired by hermes-agent Programmatic Tool Calling (PTC).
 */

import { logger } from "../utils/logger.js";
import type { PipelineStep, PipelineStepResult, PipelineResult } from "../../schemas/pipeline.schema.js";

export type ToolHandler = (args: unknown) => Promise<unknown>;

export class ToolPipeline {
  private handlers: Map<string, ToolHandler>;

  constructor(handlers: Map<string, ToolHandler>) {
    this.handlers = handlers;
  }

  async execute(steps: PipelineStep[]): Promise<PipelineResult> {
    const startTime = performance.now();
    const stepResults: PipelineStepResult[] = [];
    let failed = false;
    let previousResult: unknown = undefined;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (failed) {
        stepResults.push({
          stepIndex: i,
          tool: step.tool,
          status: "skipped",
          durationMs: 0,
        });
        continue;
      }

      const handler = this.handlers.get(step.tool);
      if (!handler) {
        stepResults.push({
          stepIndex: i,
          tool: step.tool,
          status: "error",
          error: `Tool "${step.tool}" not found in pipeline handler registry`,
          durationMs: 0,
        });
        failed = true;
        continue;
      }

      const stepStart = performance.now();
      try {
        // Merge previous result into args if available
        const args = previousResult !== undefined
          ? { ...step.args, _previousResult: previousResult }
          : step.args;

        const resultValue = await handler(args);

        const durationMs = Math.round(performance.now() - stepStart);

        // Extract field for next step if specified
        if (step.extractField && resultValue && typeof resultValue === "object") {
          previousResult = (resultValue as Record<string, unknown>)[step.extractField];
        } else {
          previousResult = resultValue;
        }

        stepResults.push({
          stepIndex: i,
          tool: step.tool,
          status: "success",
          result: resultValue,
          durationMs,
        });

        logger.debug("pipeline:step_completed", { step: i, tool: step.tool, durationMs });
      } catch (err) {
        const durationMs = Math.round(performance.now() - stepStart);
        const errorMsg = err instanceof Error ? err.message : String(err);

        stepResults.push({
          stepIndex: i,
          tool: step.tool,
          status: "error",
          error: errorMsg,
          durationMs,
        });

        failed = true;
        logger.warn("pipeline:step_failed", { step: i, tool: step.tool, error: errorMsg });
      }
    }

    const totalDurationMs = Math.round(performance.now() - startTime);
    const completed = stepResults.filter((s) => s.status === "success").length;
    const failedCount = stepResults.filter((s) => s.status === "error").length;
    const skipped = stepResults.filter((s) => s.status === "skipped").length;

    return {
      ok: failedCount === 0,
      stepsTotal: steps.length,
      stepsCompleted: completed,
      stepsFailed: failedCount,
      stepsSkipped: skipped,
      steps: stepResults,
      finalResult: previousResult,
      totalDurationMs,
    };
  }
}
