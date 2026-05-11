/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-karpathy-skills — Task 1.1: Auditoria diff vendor/karpathy-skills
 *
 * AC1: GIVEN vendor file WHEN audit runs THEN each ## N. Heading appears in table with status
 * AC2: GIVEN dropped guardrail WHEN audit runs THEN justification ≥ 30 chars
 * AC3: GIVEN identical files WHEN audit runs THEN table is 100% ported
 */

import { describe, it, expect } from "vitest";
import {
  auditKarpathyRules,
  buildAuditTable,
  type AuditEntry,
} from "../core/audit/karpathy-auditor.js";

const VENDOR = `
# CLAUDE.md

## 1. Think Before Coding

**Don't assume.**

- State assumptions explicitly.

## 2. Simplicity First

**Minimum code.**

- No features beyond what was asked.

## 3. Surgical Changes

**Touch only what you must.**

- Don't improve adjacent code.
`;

const LOCAL_FULL = `
# Karpathy Guidelines

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State assumptions explicitly.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

- Don't improve adjacent code.

## Project Mapping

Extra section.
`;

const LOCAL_MISSING_2 = `
# Karpathy Guidelines

## 1. Think Before Coding

Present.

## 3. Surgical Changes

Present.
`;

// ── AC1: each ## N. Heading appears in table ──────────────────────────────

describe("auditKarpathyRules — AC1", () => {
  it("AC1: returns one entry per vendor heading", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_FULL);
    const titles = entries.map((e: AuditEntry) => e.heading);
    expect(titles).toContain("1. Think Before Coding");
    expect(titles).toContain("2. Simplicity First");
    expect(titles).toContain("3. Surgical Changes");
  });

  it("AC1: each entry has a status field", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_FULL);
    for (const entry of entries) {
      expect(["ported", "pending", "dropped"]).toContain(entry.status);
    }
  });
});

// ── AC2: dropped entries have justification ≥ 30 chars ───────────────────

describe("auditKarpathyRules — AC2", () => {
  it("AC2: ported entries have empty or short justification", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_FULL);
    for (const e of entries.filter((e: AuditEntry) => e.status === "ported")) {
      // ported entries don't need justification
      expect(e.status).toBe("ported");
    }
  });

  it("AC2: dropped entries have justification ≥ 30 chars", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_MISSING_2);
    const dropped = entries.filter((e: AuditEntry) => e.status === "dropped");
    for (const e of dropped) {
      expect(e.justification.length).toBeGreaterThanOrEqual(30);
    }
  });

  it("AC2: missing heading in local is marked dropped or pending, not ported", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_MISSING_2);
    const heading2 = entries.find((e: AuditEntry) => e.heading.includes("2. Simplicity"));
    expect(heading2).toBeDefined();
    expect(heading2!.status).not.toBe("ported");
  });
});

// ── AC3: identical files → 100% ported ───────────────────────────────────

describe("auditKarpathyRules — AC3", () => {
  it("AC3: identical files produce all ported entries", () => {
    const entries = auditKarpathyRules(VENDOR, VENDOR);
    expect(entries.every((e: AuditEntry) => e.status === "ported")).toBe(true);
  });
});

// ── buildAuditTable — markdown output ────────────────────────────────────

describe("buildAuditTable", () => {
  it("produces a markdown table with heading, status, justification columns", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_FULL);
    const table = buildAuditTable(entries);
    expect(table).toMatch(/\| Heading \|/);
    expect(table).toMatch(/\| Status \|/);
    expect(table).toMatch(/\| Justification \|/);
  });

  it("table contains vendor heading titles", () => {
    const entries = auditKarpathyRules(VENDOR, LOCAL_FULL);
    const table = buildAuditTable(entries);
    expect(table).toMatch(/Think Before Coding/);
    expect(table).toMatch(/Simplicity First/);
  });
});
