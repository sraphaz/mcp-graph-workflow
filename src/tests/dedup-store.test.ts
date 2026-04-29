/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { HookDedupStore } from "../core/hooks/dedup-store.js";

describe("HookDedupStore — windowed dedup", () => {
  it("first call to shouldEmit returns true", () => {
    const store = new HookDedupStore(200);
    expect(store.shouldEmit("a", 1000)).toBe(true);
  });

  it("after recordEmission, shouldEmit within window returns false", () => {
    const store = new HookDedupStore(200);
    store.recordEmission("a", 1000);
    expect(store.shouldEmit("a", 1100)).toBe(false);
  });

  it("after window expires, shouldEmit returns true again", () => {
    const store = new HookDedupStore(200);
    store.recordEmission("a", 1000);
    expect(store.shouldEmit("a", 1300)).toBe(true);
  });

  it("different keys are independent", () => {
    const store = new HookDedupStore(200);
    store.recordEmission("a", 1000);
    expect(store.shouldEmit("b", 1100)).toBe(true);
    expect(store.shouldEmit("a", 1100)).toBe(false);
  });

  it("reset clears all state", () => {
    const store = new HookDedupStore(200);
    store.recordEmission("a", 1000);
    store.reset();
    expect(store.shouldEmit("a", 1100)).toBe(true);
  });

  it("prune removes expired entries and returns count", () => {
    const store = new HookDedupStore(200);
    store.recordEmission("a", 1000);
    store.recordEmission("b", 1500);
    expect(store.prune(2000)).toBe(2);
    expect(store.shouldEmit("a", 2000)).toBe(true);
  });
});
