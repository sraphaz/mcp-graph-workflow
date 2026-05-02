/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Type Coverage Scanner — Harnessability Metric dimension
 *
 * Scans TypeScript files for untyped-value usage and calculates
 * a type coverage score: (files without any) / (total files) * 100.
 *
 * Part of the Harnessability Metric (Harness Engineering).
 * v4: Optional collectViolations mode returns file-level ViolationDetail[].
 */

import type { ViolationDetail } from "./violation-detail.js";

export interface TypeCoverageResult {
  typeScore: number;
  totalFiles: number;
  filesWithAny: number;
  anyCount: number;
  /** File-level violations — only present when collectViolations=true */
  violations?: ViolationDetail[];
}

export interface FileContent {
  path: string;
  content: string;
}

export interface TypeCoverageOptions {
  /** When true, collect file-level violations with line numbers. Default: false */
  collectViolations?: boolean;
}

/**
 * Pattern to match the untyped-value keyword used as a type annotation or cast.
 * Matches the untyped-value annotation patterns, but tries to avoid false positives
 * in comments and strings (imperfect — simple regex approach).
 */
const ANY_TYPE_PATTERN = /:\s*any\b/g;
const AS_ANY_PATTERN = /\bas\s+any\b/g;

/**
 * Combined pattern for aggregate counting (backward compat).
 */
const ANY_PATTERN = /\bas\s+any\b|:\s*any\b/g;

/**
 * Scan TypeScript file contents for `any` usage.
 * Returns a score (0-100) where 100 = no untyped-value found in any file.
 * When options.collectViolations is true, also returns file-level violations.
 */
export function scanTypeCoverage(files: FileContent[], options?: TypeCoverageOptions): TypeCoverageResult {
  if (files.length === 0) {
    return {
      typeScore: 100, totalFiles: 0, filesWithAny: 0, anyCount: 0,
      ...(options?.collectViolations ? { violations: [] } : {}),
    };
  }

  const collect = options?.collectViolations === true;
  const violations: ViolationDetail[] = [];
  let totalAnyCount = 0;
  let filesWithAny = 0;

  for (const file of files) {
    const matches = file.content.match(ANY_PATTERN);
    if (matches && matches.length > 0) {
      filesWithAny++;
      totalAnyCount += matches.length;
    }

    if (collect) {
      collectFileViolations(file, ANY_TYPE_PATTERN, 'any_usage', violations);
      collectFileViolations(file, AS_ANY_PATTERN, 'as_any_cast', violations);
    }
  }

  const cleanFiles = files.length - filesWithAny;
  const typeScore = Math.round((cleanFiles / files.length) * 100);

  return {
    typeScore,
    totalFiles: files.length,
    filesWithAny,
    anyCount: totalAnyCount,
    ...(collect ? { violations } : {}),
  };
}

/** Collect violations for a single file using a regex pattern */
 
function collectFileViolations(
  file: FileContent,
  pattern: RegExp,
  violationType: string,
  out: ViolationDetail[],
): void {
  // §HARNESS — same pattern as error-handling-scanner: cloning a literal
  // RegExp for exec-state isolation; source is a RegExp object not a string.
  // eslint-disable-next-line security/detect-non-literal-regexp
  const regex = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(file.content)) !== null) {
    const line = file.content.slice(0, match.index).split('\n').length;
    out.push({
      file: file.path,
      line,
      dimension: 'types',
      violationType,
      evidence: match[0],
      confidence: 1.0,
    });
  }
}
