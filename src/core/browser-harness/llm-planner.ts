/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * LLM-driven plan generator — replaces the Phase 1 regex stub in chat-runner.
 * Given a user prompt + known helpers + guardrail, emits a typed PlannedStep[].
 */

import { z } from "zod/v4";
import { PlannedStepSchema, type PlannedStep } from "../../schemas/browser-harness.schema.js";
import { createLogger } from "../utils/logger.js";
import { OperationError } from "../utils/errors.js";

const log = createLogger({ layer: "core", source: "llm-planner.ts" });

export interface LlmLike {
  generate(messages: ReadonlyArray<{ role: "system" | "user" | "assistant"; content: string }>): Promise<{ text: string }>;
}

export interface HelperHint {
  name: string;
  signature: string;
  description?: string;
}

export interface LlmPlannerOptions {
  helpers: readonly HelperHint[];
  /** Whole-guardrail text (YAML + body) from guardrail-loader. */
  guardrail?: string;
  maxAttempts?: number;
  /** Optional override for the system prompt. */
  systemPromptOverride?: string;
}

const PlanResponseSchema = z.object({
  steps: z.array(
    z.object({
      helper: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
      expect: z.string().optional(),
    }),
  ),
});

const SYSTEM_PROMPT = `You are a browser-harness planner. Output a JSON object with a "steps" array. Each step has:
- helper: one of the known helpers (exact snake_case name)
- args: object whose keys match the helper's signature
- expect (optional): an assertion — formats:
    url_contains:<substr>
    text_visible:<css selector>
    status_eq:<code>

Rules:
- Output ONLY the JSON object. No prose, no code fences.
- If the prompt is ambiguous, make the safest minimal plan rather than refusing.
- Never invent helper names; only use those listed.
- Prefer navigate → wait_for(selector) → screenshot → assert shape.`;

export class LlmPlanner {
  constructor(
    private readonly client: LlmLike,
    private readonly options: LlmPlannerOptions,
  ) {}

  async plan(prompt: string): Promise<PlannedStep[]> {
    const maxAttempts = this.options.maxAttempts ?? 2;
    const helperList = this.options.helpers
      .map((h) => `- ${h.name}${h.description ? `  — ${h.description}` : ""} :: ${h.signature}`)
      .join("\n");
    const system = [
      this.options.systemPromptOverride ?? SYSTEM_PROMPT,
      this.options.guardrail ? `\nGuardrail:\n${this.options.guardrail}` : "",
      `\nKnown helpers:\n${helperList}`,
    ].join("");

    let feedback = "";
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const user = feedback
        ? `User request: ${prompt}\n\nYour previous response was rejected:\n${feedback}\n\nRe-emit the JSON object correctly.`
        : `User request: ${prompt}`;
      try {
        const { text } = await this.client.generate([
          { role: "system", content: system },
          { role: "user", content: user },
        ]);
        const parsed = parseJsonLoose(text);
        const safe = PlanResponseSchema.parse(parsed);
        const knownNames = new Set(this.options.helpers.map((h) => h.name));
        for (const sVar of safe.steps) {
          if (!knownNames.has(sVar.helper)) {
            throw new OperationError(`plan references unknown helper "${sVar.helper}"`);
          }
        }
        return safe.steps.map((s, i) =>
          PlannedStepSchema.parse({
            index: i,
            helper: s.helper,
            args: s.args ?? {},
            expect: s.expect,
          }),
        );
      } catch (err) {
        lastErr = err;
        feedback = err instanceof Error ? err.message : String(err);
        log.warn("bh:llm-planner:retry", { attempt, error: feedback });
      }
    }
    throw lastErr instanceof Error
      ? new Error(`LLM plan generation failed after ${maxAttempts} attempts: ${lastErr.message}`)
      : new Error(`LLM plan generation failed after ${maxAttempts} attempts`);
  }
}

function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const unwrapped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(unwrapped);
}
