/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 2.1: Hook de drift karpathy
 *
 * AC1: GIVEN vendor e rules sincronizados WHEN detector roda THEN retorna arrays vazios
 * AC2: GIVEN um parágrafo só no vendor WHEN detector roda THEN aparece em `addedInVendor`
 * AC3: GIVEN um parágrafo divergente WHEN detector roda THEN aparece em `modified` com diff
 */

import { describe, it, expect } from "vitest";
import { detectKarpathyDrift } from "../../core/hooks/karpathy-drift-detector.js";

const VENDOR_SYNCED = `# CLAUDE.md

## 1. Think Before Coding

State assumptions. Ask when uncertain.

## 2. Simplicity First

Minimum code. Nothing speculative.
`;

const RULES_SYNCED = `# Karpathy Guidelines

## 1. Think Before Coding §karpathy-1

State assumptions. Ask when uncertain.

## 2. Simplicity First §karpathy-2

Minimum code. Nothing speculative.
`;

// ── AC1: synced → empty arrays ────────────────────────────────────────────────

describe("detectKarpathyDrift — AC1: synced files return empty drift", () => {
  it("AC1: returns empty arrays when vendor and rules are semantically synced", () => {
    const drift = detectKarpathyDrift(VENDOR_SYNCED, RULES_SYNCED);
    expect(drift.addedInVendor).toEqual([]);
    expect(drift.removedFromRules).toEqual([]);
    expect(drift.modified).toEqual([]);
  });

  it("AC1: ignores §tag annotations in rules headings when comparing", () => {
    const vendor = "## Think Before Coding\n\nContent here.\n";
    const rules = "## Think Before Coding §karpathy-1\n\nContent here.\n";
    const drift = detectKarpathyDrift(vendor, rules);
    expect(drift.addedInVendor).toEqual([]);
    expect(drift.modified).toEqual([]);
  });

  it("AC1: ignores extra whitespace differences when comparing section bodies", () => {
    const vendor = "## Section\n\nLine one.  Line two.\n";
    const rules = "## Section\n\nLine one. Line two.\n";
    const drift = detectKarpathyDrift(vendor, rules);
    expect(drift.modified).toEqual([]);
  });
});

// ── AC2: paragraph only in vendor → addedInVendor ────────────────────────────

describe("detectKarpathyDrift — AC2: section only in vendor appears in addedInVendor", () => {
  it("AC2: new section in vendor (not in rules) appears in addedInVendor", () => {
    const vendor = VENDOR_SYNCED + "\n## 5. New Section\n\nNew content.\n";
    const drift = detectKarpathyDrift(vendor, RULES_SYNCED);
    expect(drift.addedInVendor).toContain("5. New Section");
  });

  it("AC2: section only in rules (not vendor) appears in removedFromRules", () => {
    const rules = RULES_SYNCED + "\n## Project Mapping §karpathy-extra\n\nLocal content.\n";
    const drift = detectKarpathyDrift(VENDOR_SYNCED, rules);
    expect(drift.removedFromRules).toContain("Project Mapping");
  });

  it("AC2: addedInVendor is empty when vendor has no sections missing from rules", () => {
    const drift = detectKarpathyDrift(VENDOR_SYNCED, RULES_SYNCED);
    expect(drift.addedInVendor).toHaveLength(0);
  });
});

// ── AC3: divergent paragraph → modified with diff ────────────────────────────

describe("detectKarpathyDrift — AC3: divergent section appears in modified", () => {
  it("AC3: section present in both but body differs appears in modified", () => {
    const rulesModified = RULES_SYNCED.replace(
      "Minimum code. Nothing speculative.",
      "Minimum code. Nothing speculative. Extra rule added here.",
    );
    const drift = detectKarpathyDrift(VENDOR_SYNCED, rulesModified);
    expect(drift.modified.length).toBeGreaterThan(0);
    const modifiedEntry = drift.modified.find((m: string) => m.includes("Simplicity First"));
    expect(modifiedEntry).toBeDefined();
  });

  it("AC3: modified entry includes the section heading", () => {
    const rulesModified = RULES_SYNCED.replace(
      "State assumptions. Ask when uncertain.",
      "State assumptions. Ask when uncertain. And verify.",
    );
    const drift = detectKarpathyDrift(VENDOR_SYNCED, rulesModified);
    expect(drift.modified.some((m: string) => m.includes("Think Before Coding"))).toBe(true);
  });

  it("AC3: unchanged section does NOT appear in modified", () => {
    const rulesModified = RULES_SYNCED.replace(
      "Minimum code. Nothing speculative.",
      "Minimum code. Nothing speculative. Changed.",
    );
    const drift = detectKarpathyDrift(VENDOR_SYNCED, rulesModified);
    expect(drift.modified.some((m: string) => m.includes("Think Before Coding"))).toBe(false);
  });
});
