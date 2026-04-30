/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-completion — deriveBrowserSkillInput unit tests.
 * Closes the remaining gap from PR #292: harness now derives the
 * BrowserSkillInput from a successful run plan so finish_task's hook
 * actually fires in production.
 */

import { describe, it, expect } from "vitest";
import { deriveBrowserSkillInput } from "../core/skills/browser-skill-proposer.js";

describe("deriveBrowserSkillInput", () => {
  it("returns null when verdict is not pass", () => {
    const r = deriveBrowserSkillInput({
      taskId: "t1",
      taskTitle: "x",
      prompt: "do thing",
      plan: [{ helper: "navigate", args: { url: "https://x.test" } }],
      verdict: "fail",
    });
    expect(r).toBeNull();
  });

  it("returns null when plan is empty", () => {
    const r = deriveBrowserSkillInput({
      taskId: "t1",
      taskTitle: "x",
      prompt: "do",
      plan: [],
      verdict: "pass",
    });
    expect(r).toBeNull();
  });

  it("returns null when no navigate step (no startUrl)", () => {
    const r = deriveBrowserSkillInput({
      taskId: "t1",
      taskTitle: "x",
      prompt: "do",
      plan: [{ helper: "screenshot", args: {} }],
      verdict: "pass",
    });
    expect(r).toBeNull();
  });

  it("derives a complete BrowserSkillInput from a passing run", () => {
    const r = deriveBrowserSkillInput({
      taskId: "task_1",
      taskTitle: "Submit form",
      prompt: "submit form on example.com",
      plan: [
        { helper: "navigate", args: { url: "https://example.com/contact" } },
        { helper: "wait_for", args: { selector: "#email", timeoutMs: 5000 } },
        { helper: "screenshot", args: {} },
      ],
      verdict: "pass",
    });
    expect(r).not.toBeNull();
    expect(r!.taskId).toBe("task_1");
    expect(r!.taskTitle).toBe("Submit form");
    expect(r!.startUrl).toBe("https://example.com/contact");
    expect(r!.steps).toHaveLength(3);
    expect(r!.steps[0]!.action).toBe("navigate");
    expect(r!.steps[1]!.selector).toBe("#email");
    expect(r!.outcome).toBe("success");
  });

  it("falls back to prompt when taskTitle is empty", () => {
    const r = deriveBrowserSkillInput({
      taskId: "t1",
      taskTitle: "",
      prompt: "click the login button",
      plan: [{ helper: "navigate", args: { url: "https://x.test" } }],
      verdict: "pass",
    });
    expect(r!.taskTitle).toBe("click the login button");
  });
});
