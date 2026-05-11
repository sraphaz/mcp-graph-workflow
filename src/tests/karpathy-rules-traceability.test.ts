/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-karpathy-skills-rules-promotion — Task 1.2: Portar guardrails pendentes
 *
 * AC1: GIVEN audit aponta N guardrails pending WHEN port roda
 *      THEN .claude/rules/karpathy.md ganha N seções com §karpathy-X no header
 * AC2: GIVEN port aplicado WHEN audit roda de novo
 *      THEN coluna "pending" fica vazia
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const KARPATHY_MD = join(process.cwd(), ".claude/rules/karpathy.md");
const AUDIT_MD = join(process.cwd(), ".claude/rules/karpathy-audit.md");

function readRules(): string {
  return readFileSync(KARPATHY_MD, "utf-8");
}

function readAudit(): string {
  return readFileSync(AUDIT_MD, "utf-8");
}

// ── AC1: all 4 vendor sections have §karpathy-N traceability marker ──────────

describe("karpathy.md — AC1: vendor traceability markers present", () => {
  it("AC1: §karpathy-1 marker present in 'Think Before Coding' section", () => {
    const content = readRules();
    expect(content).toMatch(/§karpathy-1/);
  });

  it("AC1: §karpathy-2 marker present in 'Simplicity First' section", () => {
    const content = readRules();
    expect(content).toMatch(/§karpathy-2/);
  });

  it("AC1: §karpathy-3 marker present in 'Surgical Changes' section", () => {
    const content = readRules();
    expect(content).toMatch(/§karpathy-3/);
  });

  it("AC1: §karpathy-4 marker present in 'Goal-Driven Execution' section", () => {
    const content = readRules();
    expect(content).toMatch(/§karpathy-4/);
  });

  it("AC1: marker appears on the same line as the section header", () => {
    const content = readRules();
    const lines = content.split("\n");
    const markedHeaders = lines.filter(
      (l) => l.startsWith("##") && l.includes("§karpathy-"),
    );
    expect(markedHeaders.length).toBeGreaterThanOrEqual(4);
  });
});

// ── AC2: audit shows pending = 0 ─────────────────────────────────────────────

describe("karpathy-audit.md — AC2: no pending guardrails", () => {
  it("AC2: audit file exists", () => {
    expect(() => readAudit()).not.toThrow();
  });

  it("AC2: pending count is 0", () => {
    const content = readAudit();
    expect(content).toMatch(/\*\*Pending:\*\*\s+0/);
  });

  it("AC2: no row in audit table has status 'pending'", () => {
    const content = readAudit();
    const rows = content
      .split("\n")
      .filter((l) => l.startsWith("|") && !l.startsWith("| Heading") && !l.startsWith("| ---"));
    const pendingRows = rows.filter((r) => r.toLowerCase().includes("| pending |"));
    expect(pendingRows).toHaveLength(0);
  });
});
