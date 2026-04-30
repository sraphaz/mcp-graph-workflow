/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-completion — failover-chain default resolution tests.
 */

import { describe, it, expect } from "vitest";
import {
  parseFailoverChain,
  defaultFailoverChain,
  resolveFailoverChain,
} from "../core/llm/failover-chain.js";

describe("parseFailoverChain", () => {
  it("parses comma-separated provider:model pairs", () => {
    expect(parseFailoverChain("anthropic:claude-haiku-4-5,openai:gpt-4o-mini")).toEqual([
      { provider: "anthropic", model: "claude-haiku-4-5" },
      { provider: "openai", model: "gpt-4o-mini" },
    ]);
  });

  it("ignores entries missing a colon", () => {
    expect(parseFailoverChain("anthropic-claude,openai:gpt-4o-mini")).toEqual([
      { provider: "openai", model: "gpt-4o-mini" },
    ]);
  });

  it("returns empty for undefined or empty input", () => {
    expect(parseFailoverChain(undefined)).toEqual([]);
    expect(parseFailoverChain("")).toEqual([]);
  });
});

describe("defaultFailoverChain", () => {
  it("returns at least one entry from each major provider", () => {
    const chain = defaultFailoverChain();
    expect(chain.length).toBeGreaterThanOrEqual(2);
    expect(chain.some((e) => e.provider === "anthropic")).toBe(true);
    expect(chain.some((e) => e.provider === "openai")).toBe(true);
  });
});

describe("resolveFailoverChain", () => {
  it("returns the default when LLM_FAILOVER_CHAIN is unset", () => {
    expect(resolveFailoverChain({})).toEqual(defaultFailoverChain());
  });

  it("returns parsed env when LLM_FAILOVER_CHAIN is set", () => {
    expect(
      resolveFailoverChain({ LLM_FAILOVER_CHAIN: "openai:gpt-4o-mini" }),
    ).toEqual([{ provider: "openai", model: "gpt-4o-mini" }]);
  });

  it("returns [] (opt-out) when LLM_FAILOVER_CHAIN is empty string", () => {
    expect(resolveFailoverChain({ LLM_FAILOVER_CHAIN: "" })).toEqual([]);
    expect(resolveFailoverChain({ LLM_FAILOVER_CHAIN: "   " })).toEqual([]);
  });
});
