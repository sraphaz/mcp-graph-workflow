/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { parseFailoverChain } from "../core/llm/failover-chain.js";
import {
  LlmCircuitBreaker,
  isCircuitOpenStatus,
} from "../core/llm/circuit-breaker-llm.js";

describe("parseFailoverChain", () => {
  it("parses comma-separated provider:model pairs", () => {
    const out = parseFailoverChain("anthropic:sonnet,openai:gpt-4o");
    expect(out).toEqual([
      { provider: "anthropic", model: "sonnet" },
      { provider: "openai", model: "gpt-4o" },
    ]);
  });

  it("trims whitespace around entries", () => {
    expect(parseFailoverChain(" anthropic:sonnet , openai:gpt-4o ")).toEqual([
      { provider: "anthropic", model: "sonnet" },
      { provider: "openai", model: "gpt-4o" },
    ]);
  });

  it("ignores empty entries and malformed pairs (no colon)", () => {
    expect(parseFailoverChain("anthropic:sonnet,,malformed,openai:gpt")).toEqual([
      { provider: "anthropic", model: "sonnet" },
      { provider: "openai", model: "gpt" },
    ]);
  });

  it("returns [] for undefined / empty string", () => {
    expect(parseFailoverChain(undefined)).toEqual([]);
    expect(parseFailoverChain("")).toEqual([]);
  });
});

describe("LlmCircuitBreaker", () => {
  it("starts in 'closed' state and allows requests", () => {
    const cb = new LlmCircuitBreaker({ now: () => 0 });
    expect(cb.state("anthropic")).toBe("closed");
    expect(cb.canCall("anthropic")).toBe(true);
  });

  it("opens after 3 consecutive retriable failures (401/402/429/5xx)", () => {
    const cb = new LlmCircuitBreaker({ now: () => 0 });
    cb.recordFailure("anthropic", 429);
    cb.recordFailure("anthropic", 500);
    expect(cb.state("anthropic")).toBe("closed");
    cb.recordFailure("anthropic", 401);
    expect(cb.state("anthropic")).toBe("open");
    expect(cb.canCall("anthropic")).toBe(false);
  });

  it("non-retriable status (e.g. 400) does NOT count toward the threshold", () => {
    const cb = new LlmCircuitBreaker({ now: () => 0 });
    cb.recordFailure("anthropic", 400);
    cb.recordFailure("anthropic", 400);
    cb.recordFailure("anthropic", 400);
    expect(cb.state("anthropic")).toBe("closed");
  });

  it("a success resets the consecutive-failure counter", () => {
    const cb = new LlmCircuitBreaker({ now: () => 0 });
    cb.recordFailure("anthropic", 500);
    cb.recordFailure("anthropic", 500);
    cb.recordSuccess("anthropic");
    cb.recordFailure("anthropic", 500);
    expect(cb.state("anthropic")).toBe("closed");
  });

  it("transitions open → half-open after openMs elapses; success closes it", () => {
    let now = 0;
    const cb = new LlmCircuitBreaker({ now: () => now, openMs: 60_000 });
    cb.recordFailure("a", 500);
    cb.recordFailure("a", 500);
    cb.recordFailure("a", 500);
    expect(cb.state("a")).toBe("open");
    expect(cb.canCall("a")).toBe(false);
    now = 60_001;
    expect(cb.state("a")).toBe("half-open");
    expect(cb.canCall("a")).toBe(true);
    cb.recordSuccess("a");
    expect(cb.state("a")).toBe("closed");
  });

  it("half-open + failure → reopens with a fresh open window", () => {
    let now = 0;
    const cb = new LlmCircuitBreaker({ now: () => now, openMs: 60_000 });
    cb.recordFailure("a", 500);
    cb.recordFailure("a", 500);
    cb.recordFailure("a", 500);
    now = 60_001;
    expect(cb.state("a")).toBe("half-open");
    cb.recordFailure("a", 500);
    expect(cb.state("a")).toBe("open");
    now = 60_002;
    expect(cb.canCall("a")).toBe(false); // window not yet expired
  });

  it("isCircuitOpenStatus identifies retriable HTTP statuses", () => {
    expect(isCircuitOpenStatus(401)).toBe(true);
    expect(isCircuitOpenStatus(402)).toBe(true);
    expect(isCircuitOpenStatus(429)).toBe(true);
    expect(isCircuitOpenStatus(500)).toBe(true);
    expect(isCircuitOpenStatus(503)).toBe(true);
    expect(isCircuitOpenStatus(400)).toBe(false);
    expect(isCircuitOpenStatus(404)).toBe(false);
    expect(isCircuitOpenStatus(200)).toBe(false);
  });

  it("tracks each provider independently", () => {
    const cb = new LlmCircuitBreaker({ now: () => 0 });
    cb.recordFailure("anthropic", 500);
    cb.recordFailure("anthropic", 500);
    cb.recordFailure("anthropic", 500);
    expect(cb.state("anthropic")).toBe("open");
    expect(cb.state("openai")).toBe("closed");
  });
});
