/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T13 — approval-timeout-escalate hook tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ApprovalTimeoutTracker,
  getApprovalTimeoutMs,
} from "../core/hooks/approval-timeout.js";

describe("getApprovalTimeoutMs (E21.T13)", () => {
  it("default = 300000 (5 min) when env unset", () => {
    expect(getApprovalTimeoutMs({})).toBe(300_000);
  });

  it("reads MCP_GRAPH_APPROVAL_TIMEOUT_MS override", () => {
    expect(getApprovalTimeoutMs({ MCP_GRAPH_APPROVAL_TIMEOUT_MS: "60000" })).toBe(60_000);
  });

  it("falls back to default for invalid values", () => {
    expect(getApprovalTimeoutMs({ MCP_GRAPH_APPROVAL_TIMEOUT_MS: "abc" })).toBe(300_000);
    expect(getApprovalTimeoutMs({ MCP_GRAPH_APPROVAL_TIMEOUT_MS: "0" })).toBe(300_000);
    expect(getApprovalTimeoutMs({ MCP_GRAPH_APPROVAL_TIMEOUT_MS: "-1" })).toBe(300_000);
  });
});

describe("ApprovalTimeoutTracker (E21.T13)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("arm() creates a timer that fires onTimeout when not resolved", () => {
    const onTimeout = vi.fn();
    const tracker = new ApprovalTimeoutTracker(1000, onTimeout);

    tracker.arm("approval-1", { tool: "Bash" });
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onTimeout).toHaveBeenCalledWith("approval-1", { tool: "Bash" });
  });

  it("resolve() cancels the timer (no callback fired)", () => {
    const onTimeout = vi.fn();
    const tracker = new ApprovalTimeoutTracker(1000, onTimeout);

    tracker.arm("approval-1", { tool: "Bash" });
    tracker.resolve("approval-1");
    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("multiple armed approvals fire independently", () => {
    const onTimeout = vi.fn();
    const tracker = new ApprovalTimeoutTracker(1000, onTimeout);

    tracker.arm("a", {});
    tracker.arm("b", {});
    tracker.resolve("a");
    vi.advanceTimersByTime(1500);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledWith("b", expect.any(Object));
  });

  it("re-arming same id replaces previous timer", () => {
    const onTimeout = vi.fn();
    const tracker = new ApprovalTimeoutTracker(1000, onTimeout);

    tracker.arm("a", { v: 1 });
    vi.advanceTimersByTime(500);
    tracker.arm("a", { v: 2 }); // replaces
    vi.advanceTimersByTime(800); // 800ms after second arm = 1300 total but only 800 since latest arm
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onTimeout).toHaveBeenCalledWith("a", { v: 2 });
  });

  it("resolve() on unknown id is silent no-op", () => {
    const onTimeout = vi.fn();
    const tracker = new ApprovalTimeoutTracker(1000, onTimeout);
    expect(() => tracker.resolve("nope")).not.toThrow();
  });

  it("clear() drains all timers (test cleanup)", () => {
    const onTimeout = vi.fn();
    const tracker = new ApprovalTimeoutTracker(1000, onTimeout);
    tracker.arm("a", {});
    tracker.arm("b", {});
    tracker.clear();
    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
