/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-dashboard-ux — Tab audit engine (Task 1.1)
 * Pure functions: collect tab metadata → render markdown inventory.
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TabInfo {
  path: string;
  loc: number;
  lastCommit: string;
  imports: number;
  decision: string;
}

// ---------------------------------------------------------------------------
// Markdown renderer (pure — testable without I/O)
// ---------------------------------------------------------------------------

export function buildAuditMarkdown(tabs: TabInfo[]): string {
  const rows = tabs.map((t) => {
    const name = basename(t.path).replace(".tsx", "");
    const decision = t.decision || "—";
    return `| ${name} | ${t.loc} | ${t.lastCommit} | ${t.imports} | ${decision} |`;
  });

  const counts: Record<string, number> = {};
  for (const t of tabs) {
    const key = t.decision ? t.decision.split(" ")[0] : "—";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const summaryLines = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `- **${k}**: ${v}`);

  return [
    "# Dashboard Tab Audit",
    "",
    `Total tabs: ${tabs.length}`,
    "",
    "## Inventory",
    "",
    "| Path | LOC | Last Commit | Imports | Decision |",
    "| ---- | --- | ----------- | ------- | -------- |",
    ...rows,
    "",
    "## Summary",
    "",
    ...summaryLines,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Collector (I/O — runs against the real filesystem)
// ---------------------------------------------------------------------------

function countLoc(content: string): number {
  return content.split("\n").filter((l) => l.trim().length > 0).length;
}

function countImports(content: string): number {
  return (content.match(/^import /gm) ?? []).length;
}

function lastCommitDate(filePath: string): string {
  try {
    return execSync(`git log -1 --format=%as -- "${filePath}"`, { encoding: "utf-8" }).trim() || "—";
  } catch {
    return "—";
  }
}

const DECISION_MAP: Record<string, string> = {
  "gitnexus-tab": "delete",
  "journey-run-panel": "merge → journey-tab",
  "lsp-tab": "keep",
  "lifecycle-health-tab": "merge → overview-tab",
  "hooks-tab": "keep",
  "benchmark-tab": "keep",
  "skills-tab": "keep",
  "agents-tab": "keep",
  "autopilot-tab": "keep",
  "browser-pilot-tab": "keep",
  "context-tab": "keep",
  "docs-tab": "keep",
  "graph-tab": "keep",
  "harness-tab": "keep",
  "insights-tab": "keep",
  "journey-tab": "keep",
  "kanban-tab": "keep",
  "languages-tab": "keep",
  "logs-tab": "keep",
  "memories-tab": "keep",
  "overview-tab": "keep",
  "prd-backlog-tab": "keep",
  "siebel-tab": "keep",
};

export function collectTabs(tabsDir: string): TabInfo[] {
  const files = readdirSync(tabsDir).filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"));
  return files.map((file) => {
    const fullPath = join(tabsDir, file);
    const content = readFileSync(fullPath, "utf-8");
    const name = basename(file).replace(".tsx", "");
    return {
      path: fullPath,
      loc: countLoc(content),
      lastCommit: lastCommitDate(fullPath),
      imports: countImports(content),
      decision: DECISION_MAP[name] ?? "keep",
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
}
