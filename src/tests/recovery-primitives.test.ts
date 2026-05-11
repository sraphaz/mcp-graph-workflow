/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 5.2 — recovery-primitives.ts
 *
 * AC1: snapshot + selector_missing → candidates ⊆ permutations of present attributes (property test)
 * AC2: no snapshot → explicit empty list
 * AC3: wait_too_short → suggestedWaitMs based on domain median history
 */

import { describe, it, expect } from "vitest";
import {
  proposeSelectorCandidates,
  proposeWaitIncrement,
  proposeRecovery,
  type DomElement,
  type DomSnapshot,
} from "../core/browser-harness/recovery-primitives.js";

// --- helpers ---

/** Extract all quoted string values from a CSS selector */
function extractSelectorValues(selector: string): string[] {
  const values: string[] = [];
  for (const match of selector.matchAll(/"([^"]+)"/g)) {
    const val = match[1];
    if (val !== undefined) values.push(val);
  }
  return values;
}

/** Collect all attribute values present in a snapshot */
function snapshotAttributeValues(snapshot: DomSnapshot): Set<string> {
  const vals = new Set<string>();
  for (const el of snapshot.elements) {
    if (el.tag) vals.add(el.tag);
    if (el.ariaLabel) vals.add(el.ariaLabel);
    if (el.name) vals.add(el.name);
    if (el.placeholder) vals.add(el.placeholder);
    if (el.role) vals.add(el.role);
    if (el.text) vals.add(el.text);
    if (el.dataAttrs) {
      for (const v of Object.values(el.dataAttrs)) vals.add(v);
    }
  }
  return vals;
}

// --- AC1 ---

describe("recovery-primitives — AC1: candidates ⊆ present attributes (property test)", () => {
  it("all candidate values are drawn from snapshot attributes", () => {
    const snapshot: DomSnapshot = {
      elements: [
        { tag: "button", ariaLabel: "Submit form", role: "button" },
        { tag: "input", name: "email", placeholder: "Enter your email" },
        { tag: "a", ariaLabel: "Go back", text: "Back" },
      ],
    };
    const presentValues = snapshotAttributeValues(snapshot);
    const candidates = proposeSelectorCandidates(snapshot);

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      for (const val of extractSelectorValues(candidate)) {
        expect(presentValues.has(val)).toBe(true);
      }
    }
  });

  it("property holds for snapshot with data-* only", () => {
    const snapshot: DomSnapshot = {
      elements: [
        { tag: "button", dataAttrs: { testid: "submit-btn", cy: "form-submit" } },
      ],
    };
    const presentValues = snapshotAttributeValues(snapshot);
    const candidates = proposeSelectorCandidates(snapshot);

    expect(candidates.length).toBeGreaterThan(0);
    for (const candidate of candidates) {
      for (const val of extractSelectorValues(candidate)) {
        expect(presentValues.has(val)).toBe(true);
      }
    }
  });

  it("returns at most 5 candidates regardless of snapshot size", () => {
    const elements: DomElement[] = Array.from({ length: 20 }, (_, i) => ({
      tag: "input",
      ariaLabel: `Field ${i}`,
      name: `field-${i}`,
      placeholder: `Placeholder ${i}`,
    }));
    const candidates = proposeSelectorCandidates({ elements });
    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  it("property test: multi-element snapshot with mixed attribute sets", () => {
    const snapshot: DomSnapshot = {
      elements: [
        { tag: "select", name: "country", ariaLabel: "Select country" },
        { tag: "textarea", placeholder: "Enter notes", role: "textbox" },
        { tag: "button", dataAttrs: { action: "confirm" }, ariaLabel: "Confirm" },
      ],
    };
    const presentValues = snapshotAttributeValues(snapshot);
    const candidates = proposeSelectorCandidates(snapshot);

    for (const candidate of candidates) {
      for (const val of extractSelectorValues(candidate)) {
        expect(presentValues.has(val)).toBe(true);
      }
    }
  });
});

// --- AC2 ---

describe("recovery-primitives — AC2: no snapshot → explicit empty list", () => {
  it("returns [] when snapshot is null", () => {
    expect(proposeSelectorCandidates(null)).toEqual([]);
  });

  it("returns [] when snapshot has no elements", () => {
    expect(proposeSelectorCandidates({ elements: [] })).toEqual([]);
  });

  it("returns [] when all elements have no attributes", () => {
    const snapshot: DomSnapshot = { elements: [{ tag: "div" }] };
    const candidates = proposeSelectorCandidates(snapshot);
    expect(candidates).toEqual([]);
  });

  it("proposeRecovery: selector_missing + null snapshot → empty candidates", () => {
    const result = proposeRecovery("selector_missing", null, [], 5000);
    expect(result.selectorCandidates).toEqual([]);
  });

  it("proposeRecovery: unknown failure + null snapshot → empty candidates, no wait", () => {
    const result = proposeRecovery("unknown", null, [], 5000);
    expect(result.selectorCandidates).toEqual([]);
    expect(result.suggestedWaitMs).toBeUndefined();
  });
});

// --- AC3 ---

describe("recovery-primitives — AC3: wait_too_short → increment from domain median", () => {
  it("proposeWaitIncrement: empty history → 2× current", () => {
    expect(proposeWaitIncrement([], 3000)).toBe(6000);
  });

  it("proposeWaitIncrement: odd-length history — median is middle element", () => {
    // sorted: [1000, 3000, 5000] → median=3000, proposal = max(2000, 3000*1.5)=4500
    const result = proposeWaitIncrement([5000, 1000, 3000], 1000);
    expect(result).toBeGreaterThan(1000);
    expect(result).toBe(Math.max(2000, 4500)); // 4500
  });

  it("proposeWaitIncrement: even-length history — median is avg of two middles", () => {
    // sorted: [2000,4000,6000,8000] → median=(4000+6000)/2=5000, proposal=max(4000,7500)=7500
    const result = proposeWaitIncrement([8000, 2000, 6000, 4000], 3000);
    expect(result).toBeGreaterThan(3000);
    expect(result).toBe(7500);
  });

  it("proposeWaitIncrement: always greater than current", () => {
    const current = 2000;
    const result = proposeWaitIncrement([1000, 1500], current);
    expect(result).toBeGreaterThan(current);
  });

  it("proposeRecovery: wait_too_short → suggestedWaitMs set, no selectorCandidates", () => {
    const result = proposeRecovery("wait_too_short", null, [4000, 6000, 8000], 3000);
    expect(result.suggestedWaitMs).toBeDefined();
    expect(result.suggestedWaitMs).toBeGreaterThan(3000);
    expect(result.selectorCandidates).toEqual([]);
  });

  it("proposeRecovery: selector_missing with snapshot → candidates, no suggestedWaitMs", () => {
    const snapshot: DomSnapshot = {
      elements: [{ tag: "button", ariaLabel: "Save" }],
    };
    const result = proposeRecovery("selector_missing", snapshot, [], 3000);
    expect(result.selectorCandidates.length).toBeGreaterThan(0);
    expect(result.suggestedWaitMs).toBeUndefined();
  });
});
