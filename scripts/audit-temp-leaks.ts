#!/usr/bin/env tsx
/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Audit script: detects test files that create temp dirs/files with NO cleanup at all.
 *
 * Usage:
 *   npm run audit:temp-leaks              # scan all src/tests/**\/*.test.ts
 *   tsx scripts/audit-temp-leaks.ts f.ts  # check specific files (lint-staged mode)
 *
 * Exit code: 0 = clean, 1 = violations found.
 *
 * Escape hatch: add `// @disk-leak-ok` anywhere in the file to suppress
 * (use only for intentional persistent caches like ONNX_TEST_CACHE).
 *
 * DETECTION RULES:
 *   Rule 1 — mkdtempSync with no cleanup:
 *     File has `mkdtempSync` AND has no `rmSync`, `rmdirSync`, or `unlinkSync`.
 *     Inline cleanup (rmSync per-test instead of afterAll) is accepted — it cleans on pass.
 *     True leaks are files with zero cleanup path.
 *
 *   Rule 2 — Hardcoded /tmp/ path in file-creation call with no cleanup:
 *     A line has `/tmp/` inside a mkdirSync/writeFileSync/appendFileSync/createWriteStream call,
 *     AND the file has no cleanup function at all.
 *     (Does NOT flag /tmp/ in assertions like expect(x).toContain("/tmp/"))
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface TempLeakFinding {
  file: string;
  line: number;
  pattern: string;
}

// Matches mkdtempSync call anywhere in the file
const MKDTEMP_RE = /\bmkdtempSync\b/;

// Matches /tmp/ literal inside file-creation functions (not bare string assertions)
const HARDCODED_TMP_CREATION_RE = /\b(?:mkdirSync|writeFileSync|appendFileSync|createWriteStream)\s*\([^)]*["'`]\/tmp\//;

// Cleanup functions — any of these in the file means some cleanup path exists
const CLEANUP_RE = /\b(?:rmSync|rmdirSync|unlinkSync|fs\.rm\b)/;

// Escape hatch comment
const ESCAPE_HATCH = "// @disk-leak-ok";

export function findTempLeaks(content: string, file: string): TempLeakFinding[] {
  if (content.includes(ESCAPE_HATCH)) return [];

  const hasMkdtemp = MKDTEMP_RE.test(content);
  const hasHardcodedTmpCreation = HARDCODED_TMP_CREATION_RE.test(content);
  if (!hasMkdtemp && !hasHardcodedTmpCreation) return [];

  // If ANY cleanup function exists in the file, accept it
  // (inline cleanup per-test is not ideal, but it's not a zero-cleanup leak)
  const hasAnyCleanup = CLEANUP_RE.test(content);
  if (hasAnyCleanup) return [];

  // Find first leaking line for reporting
  const lines = content.split("\n");
  const findings: TempLeakFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (MKDTEMP_RE.test(line) || HARDCODED_TMP_CREATION_RE.test(line)) {
      findings.push({
        file,
        line: i + 1,
        pattern: MKDTEMP_RE.test(line)
          ? "mkdtempSync with no rmSync/rmdirSync/unlinkSync anywhere in file"
          : "/tmp/ in file-creation call with no cleanup function in file",
      });
      break; // one finding per file
    }
  }

  return findings;
}

function collectTestFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectTestFiles(full));
    } else if (entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

// Main — runs when invoked directly
const scriptName = process.argv[1] ?? "";
if (scriptName.endsWith("audit-temp-leaks.ts") || scriptName.endsWith("audit-temp-leaks.js")) {
  // If file paths are passed as args (lint-staged mode), check only those
  const argFiles = process.argv.slice(2).filter((a) => a.endsWith(".test.ts"));
  const files =
    argFiles.length > 0
      ? argFiles
      : collectTestFiles(join(process.cwd(), "src", "tests"));

  const allFindings: TempLeakFinding[] = [];

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    allFindings.push(...findTempLeaks(content, file));
  }

  if (allFindings.length === 0) {
    process.stdout.write(`audit:temp-leaks — ${files.length} file(s) checked, 0 violations.\n`);
    process.exit(0);
  } else {
    process.stdout.write(`audit:temp-leaks — ${allFindings.length} violation(s) found:\n\n`);
    for (const f of allFindings) {
      const rel = f.file.replace(process.cwd() + "/", "");
      process.stdout.write(`  ${rel}:${f.line}  ${f.pattern}\n`);
    }
    process.stdout.write(`\nFix: add afterAll(() => rmSync(dir, { recursive: true, force: true })) for each mkdtempSync.\n`);
    process.stdout.write(`     Or add // @disk-leak-ok if accumulation is intentional (document why).\n`);
    process.exit(1);
  }
}
