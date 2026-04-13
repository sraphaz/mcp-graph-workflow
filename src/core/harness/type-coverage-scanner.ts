/**
 * Type Coverage Scanner — Harnessability Metric dimension
 *
 * Scans TypeScript files for `any` usage (: any, as any) and calculates
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
 * Pattern to match `any` used as a type annotation or cast.
 * Matches: `: any`, `as any`, `<any>`, but tries to avoid false positives
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
 * Returns a score (0-100) where 100 = no `any` found in any file.
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
// eslint-disable-next-line security/detect-non-literal-regexp
function collectFileViolations(
  file: FileContent,
  pattern: RegExp,
  violationType: string,
  out: ViolationDetail[],
): void {
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
