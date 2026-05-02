/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Translate a free-form natural-language prompt into a plan of helper calls
 * and execute it. This is intentionally simple — the agent (or a future
 * RAG-driven planner) is expected to refine plans over time. For now we
 * support a small phrase-matched DSL plus an explicit "[step]" form so
 * tests are deterministic.
 */

import type { CdpClient } from "./cdp-client.js";
import type { HelpersRegistry } from "./helpers-registry.js";
import type { HelpersRuntime } from "./helpers-runtime.js";
import type { RunsStore } from "./runs-store.js";
import type { SelfHealService } from "./self-heal.js";
import type {
  HarnessGuardrail,
  PlannedStep,
  StepResult,
  HarnessRun,
} from "../../schemas/browser-harness.schema.js";
import { isDomainAllowed } from "./guardrail-loader.js";
import { HarnessSafetyViolation } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import type { LlmPlanner } from "./llm-planner.js";
import type { BrowserEventBus, BrowserEvent, WatchdogVerdict } from "./event-bus.js";
import { attachCdpTranslator } from "./event-translator.js";

export type StepEvent =
  | { type: "plan"; steps: PlannedStep[] }
  | { type: "step"; index: number; helper: string; ok: boolean; durationMs: number; screenshotPath: string | null; error: string | null }
  | { type: "verdict"; ok: boolean; verdict: HarnessRun["verdict"]; runId: string; durationMs: number };

export type StepEventListener = (event: StepEvent) => void;

export interface RunChatInput {
  sessionId: string;
  cdp: CdpClient;
  prompt: string;
  guardrail: HarnessGuardrail;
  nodeId?: string | null;
  /** Caller-provided plan (skips intent parsing — tests + advanced UIs). */
  explicitPlan?: PlannedStep[];
}

export class ChatRunner {
  private llmPlanner: LlmPlanner | null = null;

  constructor(
    private readonly registry: HelpersRegistry,
    private readonly runtime: HelpersRuntime,
    private readonly runs: RunsStore,
    private readonly selfHeal: SelfHealService,
    private readonly listeners: Set<StepEventListener> = new Set(),
    /**
     * §extracta-wire-followups — optional event bus. When provided, the
     * runner dispatches BrowserEvents to registered watchdogs around
     * step boundaries (navigation, blank-page detection). Verdicts with
     * level="block" mark the current step as failed.
     */
    private readonly eventBus: BrowserEventBus | null = null,
  ) {}

  /** Hot-swap the LLM planner. `null` reverts to the regex fallback. */
  setLlmPlanner(planner: LlmPlanner | null): void {
    this.llmPlanner = planner;
    logger.info("bh:chat:planner", { mode: planner ? "llm" : "regex" });
  }

  on(listener: StepEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Naive prompt → plan converter. */
  generatePlan(prompt: string): PlannedStep[] {
    const steps: PlannedStep[] = [];
    let idx = 0;

    const urlMatch = prompt.match(/https?:\/\/[^\s"'<>]+/);
    if (urlMatch) {
      steps.push({ index: idx++, helper: "navigate", args: { url: urlMatch[0] }, expect: undefined });
    }

    const waitMatch = prompt.match(/(?:wait for|has an?|verify .* an?)\s*[`<]?([a-zA-Z][\w-]*)[`>]?/i);
    if (waitMatch) {
      const sel = waitMatch[1];
      steps.push({ index: idx++, helper: "wait_for", args: { selector: sel, timeoutMs: 5000 }, expect: undefined });
      steps.push({ index: idx++, helper: "get_text", args: { selector: sel }, expect: undefined });
    }

    steps.push({ index: idx, helper: "screenshot", args: {}, expect: undefined });
    return steps;
  }

  async run(input: RunChatInput): Promise<HarnessRun> {
    const start = Date.now();
    // §extracta-completion — attach CDP→BrowserEvent translator for the
    // duration of the run so dialog/download/DOM watchdogs fire live.
    const detach = this.eventBus
      ? attachCdpTranslator(input.cdp as unknown as { on: (e: string, h: (p: Record<string, unknown>) => void) => () => void }, this.eventBus, { targetId: input.sessionId })
      : null;
    const plan = input.explicitPlan ?? (await this.buildPlan(input));
    this.emit({ type: "plan", steps: plan });

    const results: StepResult[] = [];
    let overallOk = true;

    for (const step of plan) {
      const stepStart = Date.now();
      let ok: boolean;
      let error: string | null = null;
      const screenshotPath: string | null = null;
      let pngBytes: Buffer | null = null;

      try {
        if (step.helper === "navigate") {
          const url = String(step.args.url ?? "");
          if (!isDomainAllowed(url, input.guardrail)) {
            throw new HarnessSafetyViolation("domain_not_allowed", url);
          }
          // §extracta-wire-followups — dispatch cross-origin nav + blank-page events
          await this.dispatchNavigationEvents(input.sessionId, url);
        }
        const value = await this.runtime.invoke(input.cdp, step.helper, step.args);
        const vVar = value as { ok?: boolean; error?: string; base64?: string };
        ok = vVar?.ok !== false;
        if (!ok) error = vVar?.error ?? "step failed";
        if (step.helper === "screenshot" && vVar?.base64) {
          pngBytes = Buffer.from(vVar.base64, "base64");
        } else {
          // Always also capture a screenshot for the report (best-effort)
          try {
            const shot = await this.runtime.invoke(input.cdp, "screenshot", {}) as { base64?: string };
            if (shot?.base64) pngBytes = Buffer.from(shot.base64, "base64");
          } catch (err) {
            logger.debug("bh:chat:auto-screenshot:fail", { error: err instanceof Error ? err.message : String(err) });
          }
        }
      } catch (err) {
        ok = false;
        error = err instanceof Error ? err.message : String(err);
        this.selfHeal.audit(input.sessionId, "call", { helper: step.helper, args: step.args }, { error });
      }

      const durationMs = Date.now() - stepStart;
      const resultValue: StepResult = {
        index: step.index,
        helper: step.helper,
        ok,
        durationMs,
        screenshotPath: null,
        error,
      };
      results.push(resultValue);
      if (!ok) overallOk = false;

      this.emit({
        type: "step",
        index: step.index,
        helper: step.helper,
        ok,
        durationMs,
        screenshotPath,
        error,
      });

      // We hold pngBytes until the run is created so we know the final id
      (resultValue as StepResult & { _png?: Buffer | null })._png = pngBytes;
    }

    const verdict: HarnessRun["verdict"] = overallOk
      ? "pass"
      : results.some((r) => r.error?.includes("safety"))
        ? "error"
        : "fail";

    const run = this.runs.create({
      sessionId: input.sessionId,
      nodeId: input.nodeId ?? null,
      prompt: input.prompt,
      plan,
      results: results.map((r) => ({ ...r, screenshotPath: null })),
      verdict,
      durationMs: Date.now() - start,
    });

    // Persist screenshots now that we have the real run id
    const updatedResults: StepResult[] = [];
    for (const rVar of results) {
      const png = (rVar as StepResult & { _png?: Buffer | null })._png;
      let screenshotPath: string | null = null;
      if (png) {
        try {
          screenshotPath = this.runs.saveScreenshot(run.id, rVar.index, png);
        } catch (err) {
          logger.warn("bh:chat:screenshot:save:fail", { error: err instanceof Error ? err.message : String(err) });
        }
      }
      updatedResults.push({
        index: rVar.index,
        helper: rVar.helper,
        ok: rVar.ok,
        durationMs: rVar.durationMs,
        screenshotPath,
        error: rVar.error,
      });
    }
    this.runs.updateResults(run.id, updatedResults);

    this.emit({ type: "verdict", ok: overallOk, verdict, runId: run.id, durationMs: run.durationMs });
    detach?.();
    return { ...run, results: updatedResults };
  }

  private async buildPlan(input: RunChatInput): Promise<PlannedStep[]> {
    if (!this.llmPlanner) return this.generatePlan(input.prompt);
    try {
      return await this.llmPlanner.plan(input.prompt);
    } catch (err) {
      logger.warn("bh:chat:llm-planner:fallback", {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.generatePlan(input.prompt);
    }
  }

  private emit(event: StepEvent): void {
    for (const fn of this.listeners) {
      try { fn(event); } catch (err) {
        logger.warn("bh:chat:emit:error", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  /**
   * §extracta-wire-followups — dispatch navigation + blank-page events
   * to registered watchdogs. Throws HarnessSafetyViolation when a
   * watchdog returns a `level: "block"` verdict so the surrounding
   * try/catch marks the step as failed.
   */
  private async dispatchNavigationEvents(sessionId: string, url: string): Promise<void> {
    if (!this.eventBus) return;
    const ts = Date.now();

    const events: BrowserEvent[] = [];
    if (url === "" || url === "about:blank") {
      events.push({ kind: "page.blank", targetId: sessionId, ts });
    } else {
      events.push({
        kind: "navigation.cross_origin",
        targetId: sessionId,
        fromOrigin: "",
        toOrigin: url,
        ts,
      });
    }

    for (const event of events) {
      const verdicts: WatchdogVerdict[] = await this.eventBus.dispatch(event);
      for (const vVar of verdicts) {
        if (vVar.level === "block") {
          throw new HarnessSafetyViolation("watchdog_blocked", `${vVar.watchdog}: ${vVar.message}`);
        }
        if (vVar.level === "warn") {
          logger.warn("bh:watchdog:warn", { watchdog: vVar.watchdog, message: vVar.message });
        }
      }
    }
  }
}
