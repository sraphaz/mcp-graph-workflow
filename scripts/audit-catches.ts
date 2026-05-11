#!/usr/bin/env tsx
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Story 8: Empty-catch sweep
 * Usage: npm run audit:catches
 *
 * Lists all empty/comment-only catch blocks in src/**\/*.ts.
 * Pure-function core (findEmptyCatches) is exported for unit tests.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface CatchFinding {
  file: string;
  line: number;
  snippet: string;
}

const EMPTY_CATCH_RE =
  /catch\s*(?:\([^)]*\))?\s*\{(\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*)\}/g;

function isBodyEmpty(body: string): boolean {
  const stripped = body.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "").trim();
  return stripped.length === 0;
}

export function findEmptyCatches(content: string, file: string): CatchFinding[] {
  const findings: CatchFinding[] = [];
  const lines = content.split("\n");

  let match: RegExpExecArray | null;
  EMPTY_CATCH_RE.lastIndex = 0;
  while ((match = EMPTY_CATCH_RE.exec(content)) !== null) {
    const body = match[1] ?? "";
    if (!isBodyEmpty(body)) continue;

    const upToMatch = content.slice(0, match.index);
    const line = upToMatch.split("\n").length;
    const lineText = (lines[line - 1] ?? "").trim().slice(0, 80);

    findings.push({ file, line, snippet: lineText });
  }

  return findings;
}

export function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

if (process.argv[1]?.endsWith("audit-catches.ts") || process.argv[1]?.endsWith("audit-catches.js")) {
  const root = join(process.cwd(), "src");
  const files = collectTsFiles(root);
  const allFindings: CatchFinding[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    allFindings.push(...findEmptyCatches(content, file));
  }

  if (allFindings.length === 0) {
    process.stdout.write("audit:catches — no empty catch blocks found.\n");
  } else {
    process.stdout.write(`audit:catches — ${allFindings.length} empty catch(es) found:\n\n`);
    for (const f of allFindings) {
      process.stdout.write(`  ${f.file}:${f.line}  ${f.snippet}\n`);
    }
  }
}
