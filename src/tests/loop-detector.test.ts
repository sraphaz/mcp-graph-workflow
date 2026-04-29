/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { ActionLoopDetector } from "../core/llm/loop-detector.js";

describe("ActionLoopDetector", () => {
  it("returns null when no loop yet (single call)", () => {
    const det = new ActionLoopDetector();
    expect(det.record("search", { q: "foo" })).toBeNull();
  });

  it("emits LOOP_DETECTED when 3 identical calls happen within the recent window", () => {
    const det = new ActionLoopDetector({ window: 5, threshold: 3 });
    expect(det.record("search", { q: "foo" })).toBeNull();
    expect(det.record("search", { q: "foo" })).toBeNull();
    const result = det.record("search", { q: "foo" });
    expect(result).not.toBeNull();
    expect(result?.event).toBe("LOOP_DETECTED");
    expect(result?.toolName).toBe("search");
    expect(result?.count).toBe(3);
  });

  it("normalizes case and key order so { a:1, b:2 } === { b:2, a:1 }", () => {
    const det = new ActionLoopDetector({ window: 5, threshold: 2 });
    det.record("Search", { a: 1, b: 2 });
    const result = det.record("search", { b: 2, a: 1 });
    expect(result?.event).toBe("LOOP_DETECTED");
  });

  it("does not trigger when there are fewer than threshold matches in window", () => {
    const det = new ActionLoopDetector({ window: 5, threshold: 3 });
    det.record("a", {});
    det.record("b", {});
    det.record("c", {});
    det.record("a", {});
    expect(det.record("a", {})).not.toBeNull(); // 3 of 'a' in window
    const fresh = new ActionLoopDetector({ window: 5, threshold: 3 });
    fresh.record("a", {});
    fresh.record("b", {});
    fresh.record("c", {});
    fresh.record("d", {});
    expect(fresh.record("a", {})).toBeNull(); // only 2 of 'a' in window
  });

  it("rolling window evicts oldest entries", () => {
    const det = new ActionLoopDetector({ window: 3, threshold: 2 });
    det.record("a", {});
    det.record("b", {});
    det.record("c", {});
    // window now [a, b, c]; another 'a' enters and 'a' (first) is evicted.
    expect(det.record("a", {})).toBeNull(); // only 1 'a' in last 3
  });

  it("nudge is a soft string — does not throw or kill anything", () => {
    const det = new ActionLoopDetector({ window: 5, threshold: 2 });
    det.record("foo", { x: 1 });
    const result = det.record("foo", { x: 1 });
    expect(result?.nudge).toBeTypeOf("string");
    expect(result?.nudge).toContain("Loop detected");
    expect(result?.nudge).toContain("foo");
  });

  it("respects custom window and threshold from constructor", () => {
    const det = new ActionLoopDetector({ window: 20, threshold: 3 });
    expect(det.config.window).toBe(20);
    expect(det.config.threshold).toBe(3);
  });

  it("default config: window=20, threshold=3", () => {
    const det = new ActionLoopDetector();
    expect(det.config.window).toBe(20);
    expect(det.config.threshold).toBe(3);
  });
});
