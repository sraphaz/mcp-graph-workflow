/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-karpathy-skills — Task 1.1: Karpathy rules audit (vendor vs local).
 *
 * Pure functions: auditKarpathyRules, buildAuditTable.
 * No I/O — callers are responsible for reading/writing files.
 */

export type AuditStatus = "ported" | "pending" | "dropped";

export interface AuditEntry {
  heading: string;
  status: AuditStatus;
  justification: string;
}

function extractHeadings(content: string): string[] {
  return content
    .split("\n")
    .filter((line) => /^##\s+/.test(line))
    .map((line) => line.replace(/^##\s+/, "").trim());
}

function headingNormalise(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isPresent(heading: string, targetContent: string): boolean {
  const norm = headingNormalise(heading);
  const targetHeadings = extractHeadings(targetContent).map(headingNormalise);
  return targetHeadings.some((t) => t === norm);
}

const DROP_JUSTIFICATIONS: Record<string, string> = {
  default: "Heading not ported to local rules — verify relevance and re-evaluate for future promotion.",
};

function justification(heading: string, status: AuditStatus): string {
  if (status !== "dropped") return "";
  const norm = headingNormalise(heading);
  return DROP_JUSTIFICATIONS[norm] ?? DROP_JUSTIFICATIONS["default"]!;
}

export function auditKarpathyRules(vendorContent: string, localContent: string): AuditEntry[] {
  const vendorHeadings = extractHeadings(vendorContent);
  return vendorHeadings.map((heading) => {
    const present = isPresent(heading, localContent);
    const status: AuditStatus = present ? "ported" : "dropped";
    return {
      heading,
      status,
      justification: justification(heading, status),
    };
  });
}

export function buildAuditTable(entries: AuditEntry[]): string {
  const rows = entries.map((e) =>
    `| ${e.heading} | ${e.status} | ${e.justification || "—"} |`,
  );
  return [
    "| Heading | Status | Justification |",
    "|---------|--------|---------------|",
    ...rows,
  ].join("\n");
}
