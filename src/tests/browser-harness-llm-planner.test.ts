/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, vi } from "vitest";
import { LlmPlanner, type LlmLike } from "../core/browser-harness/llm-planner.js";

function stubLlm(textReturns: string[]): LlmLike {
  const queue = [...textReturns];
  return {
    generate: vi.fn().mockImplementation(async () => {
      const text = queue.shift() ?? "{}";
      return { text };
    }),
  } as unknown as LlmLike;
}

describe("LlmPlanner", () => {
  it("returns parsed steps on a valid JSON response", async () => {
    const client = stubLlm([
      JSON.stringify({
        steps: [
          { helper: "navigate", args: { url: "https://example.com" }, expect: "url_contains:example" },
          { helper: "wait_for", args: { selector: "h1" } },
        ],
      }),
    ]);
    const planner = new LlmPlanner(client, {
      helpers: [
        { name: "navigate", signature: "{url}" },
        { name: "wait_for", signature: "{selector}" },
      ],
    });
    const plan = await planner.plan("open example.com and verify there is an h1");
    expect(plan).toHaveLength(2);
    expect(plan[0].helper).toBe("navigate");
    expect(plan[0].index).toBe(0);
    expect(plan[1].helper).toBe("wait_for");
    expect(plan[1].index).toBe(1);
  });

  it("strips code fences and reparses", async () => {
    const client = stubLlm([
      "```json\n" + JSON.stringify({ steps: [{ helper: "navigate", args: { url: "x" } }] }) + "\n```",
    ]);
    const planner = new LlmPlanner(client, { helpers: [{ name: "navigate", signature: "{url}" }] });
    const plan = await planner.plan("prompt");
    expect(plan[0].helper).toBe("navigate");
  });

  it("retries once when the first response is malformed", async () => {
    const client = stubLlm([
      "this is not json",
      JSON.stringify({ steps: [{ helper: "navigate", args: { url: "x" } }] }),
    ]);
    const planner = new LlmPlanner(client, {
      helpers: [{ name: "navigate", signature: "{url}" }],
      maxAttempts: 2,
    });
    const plan = await planner.plan("prompt");
    expect(plan).toHaveLength(1);
  });

  it("throws after maxAttempts when the model never returns valid JSON", async () => {
    const client = stubLlm(["bad1", "bad2", "bad3"]);
    const planner = new LlmPlanner(client, {
      helpers: [{ name: "navigate", signature: "{url}" }],
      maxAttempts: 3,
    });
    await expect(planner.plan("prompt")).rejects.toThrow(/plan/i);
  });

  it("rejects plans that call helpers outside the registry", async () => {
    const client = stubLlm([
      JSON.stringify({ steps: [{ helper: "hack_tool", args: {} }] }),
    ]);
    const planner = new LlmPlanner(client, {
      helpers: [{ name: "navigate", signature: "{url}" }],
      maxAttempts: 1,
    });
    await expect(planner.plan("prompt")).rejects.toThrow(/helper/i);
  });
});
