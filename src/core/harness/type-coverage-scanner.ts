/**
 * Type Coverage Scanner — Harnessability Metric dimension
 *
 * Scans TypeScript files for `any` usage (: any, as any) and calculates
 * a type coverage score: (files without any) / (total files) * 100.
 *
 * Part of the Harnessability Metric (Harness Engineering).
 */

export interface TypeCoverageResult {
  typeScore: number;
  totalFiles: number;
  filesWithAny: number;
  anyCount: number;
}

export interface FileContent {
  path: string;
  content: string;
}

/**
 * Pattern to match `any` used as a type annotation or cast.
 * Matches: `: any`, `as any`, `<any>`, but tries to avoid false positives
 * in comments and strings (imperfect — simple regex approach).
 */
const ANY_PATTERN = /\bas\s+any\b|:\s*any\b/g;

/**
 * Scan TypeScript file contents for `any` usage.
 * Returns a score (0-100) where 100 = no `any` found in any file.
 */
export function scanTypeCoverage(files: FileContent[]): TypeCoverageResult {
  if (files.length === 0) {
    return { typeScore: 100, totalFiles: 0, filesWithAny: 0, anyCount: 0 };
  }

  let totalAnyCount = 0;
  let filesWithAny = 0;

  for (const file of files) {
    const matches = file.content.match(ANY_PATTERN);
    if (matches && matches.length > 0) {
      filesWithAny++;
      totalAnyCount += matches.length;
    }
  }

  const cleanFiles = files.length - filesWithAny;
  const typeScore = Math.round((cleanFiles / files.length) * 100);

  return {
    typeScore,
    totalFiles: files.length,
    filesWithAny,
    anyCount: totalAnyCount,
  };
}
