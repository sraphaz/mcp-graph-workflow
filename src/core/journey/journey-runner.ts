/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Drive a `JourneyMap` variant against a live browser (or any injected step
 * executor), persist the run, and emit live events. This module intentionally
 * does NOT own the browser — callers pass a `StepExecutor` so we can swap in
 * CDP helpers, Playwright, or fakes for tests.
 */

import type {
  JourneyMapFull,
  JourneyScreen,
  JourneyVariant,
} from "./journey-store.js";
import type { JourneyRunsStore } from "./journey-runs-store.js";
import {
  type JourneyRun,
  type JourneyRunEvent,
  type JourneyPlannedStep,
  type JourneyStepResult,
  type JourneyRunVerdict,
} from "../../schemas/journey-run.schema.js";
import { shouldOcr } from "./ocr-service.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "journey-runner.ts" });

/** Minimal interface a step executor must satisfy. Return shape mirrors the
 *  browser-harness built-in helpers so we can plug the real runtime in later. */
export type StepExecutor = (
  helper: string,
  args: Record<string, unknown>,
) => Promise<StepExecutorResult>;

export interface StepExecutorResult {
  ok: boolean;
  base64?: string;
  text?: string;
  error?: string;
  [key: string]: unknown;
}

/** Minimal OCR interface — the concrete `OcrService` satisfies this. */
export interface OcrLike {
  recognise: (pngBytes: Buffer) => Promise<{ text: string; confidence: number }>;
}

export type JourneyRunEventListener = (event: JourneyRunEvent) => void;

export interface RunJourneyInput {
  map: JourneyMapFull;
  variantId: string | null;
  nodeId?: string | null;
  prompt?: string | null;
}

export interface JourneyRunnerDeps {
  runs: JourneyRunsStore;
  executor: StepExecutor;
  ocr?: OcrLike;
}

export class JourneyRunner {
  private readonly listeners = new Set<JourneyRunEventListener>();

  constructor(private readonly deps: JourneyRunnerDeps) {}

  on(listener: JourneyRunEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async run(input: RunJourneyInput): Promise<JourneyRun> {
    const start = Date.now();
    const screens = this.resolveScreens(input.map, input.variantId);
    const plan = buildPlan(screens);

    // Persist the run eagerly so UI can watch progress.
    const initial = this.deps.runs.create({
      mapId: input.map.id,
      variantId: input.variantId,
      nodeId: input.nodeId ?? null,
      prompt: input.prompt ?? null,
      plan,
      results: [],
      verdict: "running",
      durationMs: 0,
    });

    this.emit({ type: "plan", steps: plan });

    const results: JourneyStepResult[] = [];
    let overallOk = true;

    for (const step of plan) {
      const stepStart = Date.now();
      let ok: boolean;
      let error: string | null = null;
      let pngBytes: Buffer | null = null;
      let domText: string | null = null;

      try {
        const resValue = await this.deps.executor(step.helper, step.args);
        ok = resValue.ok !== false;
        if (!ok) error = resValue.error ?? "step failed";
        if (resValue.base64) pngBytes = Buffer.from(resValue.base64, "base64");
        if (typeof resValue.text === "string") domText = resValue.text;
      } catch (err) {
        ok = false;
        error = err instanceof Error ? err.message : String(err);
      }

      const durationMs = Date.now() - stepStart;

      let screenshotPath: string | null = null;
      if (pngBytes) {
        try {
          screenshotPath = this.deps.runs.saveScreenshot(initial.id, step.index, pngBytes);
        } catch (err) {
          log.warn("journey:runner:screenshot:save:fail", { error: err instanceof Error ? err.message : String(err) });
        }
      }

      let ocrText: string | null = null;
      if (pngBytes && this.deps.ocr && shouldOcr(step.helper, domText)) {
        try {
          const ocr = await this.deps.ocr.recognise(pngBytes);
          ocrText = ocr.text || null;
          if (ocrText) {
            this.emit({ type: "ocr", index: step.index, text: ocrText, confidence: ocr.confidence });
          }
        } catch (err) {
          log.warn("journey:runner:ocr:fail", { error: err instanceof Error ? err.message : String(err) });
        }
      }

      if (!ok) overallOk = false;

      const resultValue: JourneyStepResult = {
        index: step.index,
        screenId: step.screenId,
        helper: step.helper,
        args: step.args,
        ok,
        durationMs,
        screenshotPath,
        ocrText,
        domText,
        error,
      };
      results.push(resultValue);

      // Persist progressive results so tab can poll for live state if SSE drops.
      this.deps.runs.updateResults(initial.id, results);

      this.emit({
        type: "step",
        index: step.index,
        screenId: step.screenId,
        helper: step.helper,
        ok,
        durationMs,
        error,
      });
    }

    const verdict: JourneyRunVerdict = overallOk ? "pass" : "fail";
    const durationMs = Date.now() - start;

    this.deps.runs.finalise(initial.id, { results, verdict, durationMs });

    this.emit({
      type: "verdict",
      verdict,
      ok: overallOk,
      runId: initial.id,
      durationMs,
    });

    const finalRun: JourneyRun = {
      ...initial,
      results,
      verdict,
      durationMs,
      finishedAt: Date.now(),
    };
    return finalRun;
  }

  private resolveScreens(map: JourneyMapFull, variantId: string | null): JourneyScreen[] {
    if (!variantId) return map.screens;
    const variant = map.variants.find((v: JourneyVariant) => v.id === variantId);
    if (!variant) return map.screens;
    const byId = new Map(map.screens.map((s) => [s.id, s]));
    return variant.path
      .map((sid: string) => byId.get(sid))
      .filter((s): s is JourneyScreen => !!s);
  }

  private emit(event: JourneyRunEvent): void {
    for (const fn of this.listeners) {
      try { fn(event); } catch (err) {
        log.warn("journey:runner:emit:error", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
}

/** buildPlan — auto-generated description placeholder. */
export function buildPlan(screens: JourneyScreen[]): JourneyPlannedStep[] {
  const plan: JourneyPlannedStep[] = [];
  let idx = 0;
  for (const screen of screens) {
    if (screen.url) {
      plan.push({
        index: idx++,
        screenId: screen.id,
        helper: "navigate",
        args: { url: screen.url },
      });
    }
    plan.push({
      index: idx++,
      screenId: screen.id,
      helper: "screenshot",
      args: {},
    });
  }
  return plan;
}
