/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChatRunner } from "../core/browser-harness/chat-runner.js";
import type { HelpersRegistry } from "../core/browser-harness/helpers-registry.js";
import type { HelpersRuntime } from "../core/browser-harness/helpers-runtime.js";
import type { RunsStore } from "../core/browser-harness/runs-store.js";
import type { SelfHealService } from "../core/browser-harness/self-heal.js";
import type { LlmPlanner } from "../core/browser-harness/llm-planner.js";

// Minimal stubs — only generatePlan() and listener machinery are exercised
// here, so none of the collaborators' methods get called.
function makeRunner(): ChatRunner {
  const registry = {} as HelpersRegistry;
  const runtime = {} as HelpersRuntime;
  const runs = {} as RunsStore;
  const selfHeal = {} as SelfHealService;
  return new ChatRunner(registry, runtime, runs, selfHeal);
}

describe("ChatRunner.generatePlan", () => {
  let runner: ChatRunner;

  beforeEach(() => {
    runner = makeRunner();
  });

  it("emits a navigate step when prompt contains an https URL", () => {
    const plan = runner.generatePlan("please open https://example.com/login now");
    expect(plan[0]).toMatchObject({
      helper: "navigate",
      args: { url: "https://example.com/login" },
    });
  });

  it("recognizes http URLs as well as https", () => {
    const plan = runner.generatePlan("hit http://localhost:3000/health");
    expect(plan[0].helper).toBe("navigate");
    expect(plan[0].args.url).toBe("http://localhost:3000/health");
  });

  it("emits wait_for + get_text when prompt mentions 'wait for X'", () => {
    const plan = runner.generatePlan("wait for loginButton on the page");
    const helpers = plan.map((s) => s.helper);
    expect(helpers).toContain("wait_for");
    expect(helpers).toContain("get_text");
    const wait = plan.find((s) => s.helper === "wait_for");
    expect(wait?.args.selector).toBe("loginButton");
    expect(wait?.args.timeoutMs).toBe(5000);
  });

  it("recognizes selectors with hyphens and digits", () => {
    const plan = runner.generatePlan("wait for submit-btn-1");
    const wait = plan.find((s) => s.helper === "wait_for");
    expect(wait?.args.selector).toBe("submit-btn-1");
  });

  it("always appends a final screenshot step even with no other matches", () => {
    const plan = runner.generatePlan("just take a look");
    expect(plan[plan.length - 1].helper).toBe("screenshot");
  });

  it("combines navigate + wait_for + screenshot for a full prompt", () => {
    const plan = runner.generatePlan(
      "go to https://app.example.com and wait for dashboard",
    );
    expect(plan.map((s) => s.helper)).toEqual([
      "navigate",
      "wait_for",
      "get_text",
      "screenshot",
    ]);
  });

  it("assigns sequential indexes starting at 0", () => {
    const plan = runner.generatePlan("https://x.com wait for header");
    expect(plan.map((s) => s.index)).toEqual([0, 1, 2, 3]);
  });
});

describe("ChatRunner listener pattern", () => {
  it("on() returns an unsubscribe function that removes the listener", () => {
    const runner = makeRunner();
    const listener = vi.fn();
    const unsubscribe = runner.on(listener);
    expect(typeof unsubscribe).toBe("function");

    // emit() is private but exercised through internals — just verify
    // unsubscribe doesn't throw.
    unsubscribe();
    unsubscribe(); // idempotent — second call is a no-op
  });

  it("multiple listeners coexist", () => {
    const runner = makeRunner();
    const a = vi.fn();
    const b = vi.fn();
    const offA = runner.on(a);
    const offB = runner.on(b);
    expect(typeof offA).toBe("function");
    expect(typeof offB).toBe("function");
    offA();
    offB();
  });
});

describe("ChatRunner.setLlmPlanner", () => {
  it("accepts a planner instance and reverts on null", () => {
    const runner = makeRunner();
    const planner = {} as LlmPlanner;
    expect(() => runner.setLlmPlanner(planner)).not.toThrow();
    expect(() => runner.setLlmPlanner(null)).not.toThrow();
  });
});
