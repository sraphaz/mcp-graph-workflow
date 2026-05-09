/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 1.1 — Dashboard tab audit script
 *
 * AC1: script generates markdown with complete inventory
 * AC2: each tab has a proposed decision (keep | merge→X | delete | rename→Y)
 * AC3: decisions become source-of-truth for Tasks 1.2–1.4
 */

import { describe, it, expect } from "vitest";
import { buildAuditMarkdown, type TabInfo } from "../core/dashboard/tab-auditor.js";

const FIXTURE: TabInfo[] = [
  { path: "src/web/dashboard/src/components/tabs/graph-tab.tsx", loc: 312, lastCommit: "2026-04-10", imports: 14, decision: "keep" },
  { path: "src/web/dashboard/src/components/tabs/gitnexus-tab.tsx", loc: 48, lastCommit: "2026-01-15", imports: 2, decision: "delete" },
  { path: "src/web/dashboard/src/components/tabs/journey-run-panel.tsx", loc: 89, lastCommit: "2026-03-20", imports: 5, decision: "merge → journey-tab" },
];

describe("buildAuditMarkdown — AC1: complete inventory", () => {
  it("should include a markdown table header", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toMatch(/\|\s*Path\s*\|/i);
    expect(md).toMatch(/\|\s*LOC\s*\|/i);
    expect(md).toMatch(/\|\s*Last Commit\s*\|/i);
    expect(md).toMatch(/\|\s*Imports\s*\|/i);
    expect(md).toMatch(/\|\s*Decision\s*\|/i);
  });

  it("should include a row for every tab", () => {
    const md = buildAuditMarkdown(FIXTURE);
    for (const tab of FIXTURE) {
      expect(md).toContain(tab.path.split("/").pop()!.replace(".tsx", ""));
    }
  });

  it("should include LOC and import counts", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toContain("312");
    expect(md).toContain("48");
    expect(md).toContain("14");
    expect(md).toContain("2");
  });
});

describe("buildAuditMarkdown — AC2: decision per tab", () => {
  it("should include keep decision", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toContain("keep");
  });

  it("should include delete decision", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toContain("delete");
  });

  it("should include merge decision with target", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toContain("merge → journey-tab");
  });

  it("should not produce any rows without a decision", () => {
    const noDecision: TabInfo[] = [{ path: "x.tsx", loc: 1, lastCommit: "2026-01-01", imports: 0, decision: "" }];
    const md = buildAuditMarkdown(noDecision);
    // Empty decision renders as placeholder
    expect(md).toContain("—");
  });
});

describe("buildAuditMarkdown — AC3: summary section", () => {
  it("should include a summary with totals", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toMatch(/total.*tab|tab.*total/i);
  });

  it("should count decisions by type", () => {
    const md = buildAuditMarkdown(FIXTURE);
    expect(md).toMatch(/keep.*1|1.*keep/i);
    expect(md).toMatch(/delete.*1|1.*delete/i);
    expect(md).toMatch(/merge.*1|1.*merge/i);
  });
});
