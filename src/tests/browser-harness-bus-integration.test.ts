/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-wire-followups — integration: ChatRunner ↔ BrowserEventBus.
 * Verifies that the runner dispatches navigation + blank-page events
 * around `navigate` steps, that warn verdicts log without aborting,
 * and that block verdicts mark the step as failed.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatRunner } from "../core/browser-harness/chat-runner.js";
import { BrowserEventBus } from "../core/browser-harness/event-bus.js";
import {
  registerSecurityWatchdog,
  registerBlankPageWatchdog,
} from "../core/browser-harness/watchdogs/index.js";
import type { CdpClient } from "../core/browser-harness/cdp-client.js";
import type { HelpersRegistry } from "../core/browser-harness/helpers-registry.js";
import type { HelpersRuntime } from "../core/browser-harness/helpers-runtime.js";
import type { RunsStore } from "../core/browser-harness/runs-store.js";
import type { SelfHealService } from "../core/browser-harness/self-heal.js";
import type { HarnessGuardrail, HarnessRun } from "../schemas/browser-harness.schema.js";

function makeStubs(): {
  registry: HelpersRegistry;
  runtime: HelpersRuntime;
  runs: RunsStore;
  selfHeal: SelfHealService;
  cdp: CdpClient;
  guardrail: HarnessGuardrail;
  runs_created: HarnessRun[];
} {
  const runs_created: HarnessRun[] = [];
  const runtime = {
    invoke: vi.fn(async () => ({ ok: true })),
  } as unknown as HelpersRuntime;
  const runs = {
    create: vi.fn((r: Partial<HarnessRun>) => {
      const run: HarnessRun = {
        id: "run_1",
        sessionId: r.sessionId ?? "s1",
        nodeId: r.nodeId ?? null,
        prompt: r.prompt ?? "",
        plan: r.plan ?? [],
        results: r.results ?? [],
        verdict: r.verdict ?? "pass",
        durationMs: r.durationMs ?? 0,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      } as unknown as HarnessRun;
      runs_created.push(run);
      return run;
    }),
    updateResults: vi.fn(),
  } as unknown as RunsStore;
  const selfHeal = { audit: vi.fn() } as unknown as SelfHealService;
  const cdp = {} as unknown as CdpClient;
  const guardrail: HarnessGuardrail = {
    allowedDomains: ["allowed.test", "example.com"],
    forbiddenCdpMethods: [],
  } as unknown as HarnessGuardrail;
  return {
    registry: {} as HelpersRegistry,
    runtime,
    runs,
    selfHeal,
    cdp,
    guardrail,
    runs_created,
  };
}

describe("ChatRunner — BrowserEventBus integration", () => {
  let bus: BrowserEventBus;
  let s: ReturnType<typeof makeStubs>;

  beforeEach(() => {
    bus = new BrowserEventBus();
    s = makeStubs();
  });

  it("with no bus, runner behaves exactly as before (no dispatch)", async () => {
    const runner = new ChatRunner(s.registry, s.runtime, s.runs, s.selfHeal);
    const result = await runner.run({
      sessionId: "s1",
      cdp: s.cdp,
      prompt: "navigate to https://example.com/page",
      guardrail: s.guardrail,
      explicitPlan: [
        { index: 0, helper: "navigate", args: { url: "https://example.com/page" }, expect: undefined },
      ],
    });
    expect(result.verdict).toBe("pass");
  });

  it("security watchdog blocks disallowed cross-origin nav → step fails", async () => {
    registerSecurityWatchdog(bus, { allowedOrigins: ["allowed.test"] });
    const runner = new ChatRunner(s.registry, s.runtime, s.runs, s.selfHeal, undefined, bus);
    const result = await runner.run({
      sessionId: "s1",
      cdp: s.cdp,
      prompt: "go elsewhere",
      guardrail: { ...s.guardrail, allowedDomains: ["evil.test"] } as HarnessGuardrail,
      explicitPlan: [
        { index: 0, helper: "navigate", args: { url: "https://evil.test/" }, expect: undefined },
      ],
    });
    // Step failed because the security watchdog returned "block"
    expect(result.verdict).not.toBe("pass");
    expect(result.results[0]!.ok).toBe(false);
    expect(result.results[0]!.error).toMatch(/security|watchdog/i);
  });

  it("blank-page watchdog warns on about:blank navigation but does not abort", async () => {
    registerBlankPageWatchdog(bus);
    const runner = new ChatRunner(s.registry, s.runtime, s.runs, s.selfHeal, undefined, bus);
    const result = await runner.run({
      sessionId: "s1",
      cdp: s.cdp,
      prompt: "go nowhere",
      guardrail: { ...s.guardrail, allowedDomains: ["*"] } as HarnessGuardrail,
      explicitPlan: [
        { index: 0, helper: "navigate", args: { url: "about:blank" }, expect: undefined },
      ],
    });
    // Warn does not abort — the step still completes (fake runtime returns ok)
    expect(result.results[0]!.ok).toBe(true);
  });

  it("dispatches navigation.cross_origin event on real URLs", async () => {
    const seen: string[] = [];
    bus.on("navigation.cross_origin", "test-spy", (e) => {
      seen.push(e.toOrigin);
      return undefined;
    });
    const runner = new ChatRunner(s.registry, s.runtime, s.runs, s.selfHeal, undefined, bus);
    await runner.run({
      sessionId: "s1",
      cdp: s.cdp,
      prompt: "go",
      guardrail: { ...s.guardrail, allowedDomains: ["*"] } as HarnessGuardrail,
      explicitPlan: [
        { index: 0, helper: "navigate", args: { url: "https://example.com/x" }, expect: undefined },
      ],
    });
    expect(seen).toContain("https://example.com/x");
  });
});
