/**
 * TDD tests for remaining Harness Engineering tasks:
 * - Task 2.3: Barrel Export Integrity
 * - Task 3.3: Rules & Docs Coverage Scanner
 * - Task 3.4: Harnessability Score Composto
 */
import { describe, it, expect } from 'vitest';
import { checkBarrelIntegrity } from '../core/harness/fitness-functions.js';
import { scanDocsCoverage } from '../core/harness/docs-coverage-scanner.js';
import { computeHarnessabilityScore } from '../core/harness/harnessability-score.js';

// ── Task 2.3: Barrel Export Integrity ──────────────────

describe('Fitness: Barrel Export Integrity', () => {
  it('should pass when index.ts re-exports all sibling modules', () => {
    const dirs = [{
      path: 'src/core/utils',
      files: ['errors.ts', 'logger.ts', 'time.ts', 'index.ts'],
      indexContent: 'export { AppError } from "./errors.js";\nexport { logger } from "./logger.js";\nexport { now } from "./time.js";',
    }];
    const result = checkBarrelIntegrity(dirs);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should detect missing exports in barrel', () => {
    const dirs = [{
      path: 'src/core/utils',
      files: ['errors.ts', 'logger.ts', 'time.ts', 'id.ts', 'index.ts'],
      indexContent: 'export { AppError } from "./errors.js";\nexport { logger } from "./logger.js";',
    }];
    const result = checkBarrelIntegrity(dirs);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it('should report directory without barrel as warning', () => {
    const dirs = [{
      path: 'src/core/search',
      files: ['fts-search.ts', 'tfidf.ts'],
      indexContent: null, // no index.ts
    }];
    const result = checkBarrelIntegrity(dirs);
    // No barrel = not a violation (optional), but reported
    expect(result.checkedFiles).toBe(1);
  });
});

// ── Task 3.3: Rules & Docs Coverage Scanner ────────────

describe('Docs Coverage Scanner', () => {
  it('should return 100% when all items present', () => {
    const result = scanDocsCoverage({
      hasClaudeMd: true,
      hasReadme: true,
      rulesCount: 5,
      srcDirsCount: 5,
      hasDocsDir: true,
    });
    expect(result.docsScore).toBe(100);
  });

  it('should penalize missing CLAUDE.md heavily', () => {
    const result = scanDocsCoverage({
      hasClaudeMd: false,
      hasReadme: true,
      rulesCount: 5,
      srcDirsCount: 5,
      hasDocsDir: true,
    });
    expect(result.docsScore).toBeLessThan(75);
  });

  it('should penalize missing README.md', () => {
    const result = scanDocsCoverage({
      hasClaudeMd: true,
      hasReadme: false,
      rulesCount: 5,
      srcDirsCount: 5,
      hasDocsDir: true,
    });
    expect(result.docsScore).toBeLessThan(85);
  });

  it('should return structure with all fields', () => {
    const result = scanDocsCoverage({
      hasClaudeMd: true,
      hasReadme: true,
      rulesCount: 3,
      srcDirsCount: 5,
      hasDocsDir: true,
    });
    expect(result).toHaveProperty('docsScore');
    expect(result).toHaveProperty('hasClaudeMd');
    expect(result).toHaveProperty('hasReadme');
    expect(result).toHaveProperty('rulesCount');
    expect(result).toHaveProperty('dirsCount');
  });
});

// ── Task 3.4: Harnessability Score ─────────────────────

describe('Harnessability Score', () => {
  it('should compute weighted score from 4 dimensions (v2 weights, new dims default 100)', () => {
    const result = computeHarnessabilityScore({
      typeScore: 95,
      testScore: 80,
      fitnessScore: 100,
      docsScore: 70,
    });
    // v2: 95*0.25 + 80*0.25 + 100*0.15 + 70*0.15 + 100*0.10 + 100*0.05 + 100*0.05
    // = 23.75 + 20 + 15 + 10.5 + 10 + 5 + 5 = 89.25 ~ 89.3
    expect(result.score).toBeCloseTo(89.3, 0);
    expect(result.grade).toBe('A');
  });

  it('should grade A for score >= 85', () => {
    const result = computeHarnessabilityScore({ typeScore: 90, testScore: 90, fitnessScore: 90, docsScore: 90 });
    expect(result.grade).toBe('A');
  });

  it('should grade B for score 70-84', () => {
    const result = computeHarnessabilityScore({ typeScore: 75, testScore: 75, fitnessScore: 75, docsScore: 75 });
    expect(result.grade).toBe('B');
  });

  it('should grade C for score 55-69', () => {
    const result = computeHarnessabilityScore({ typeScore: 60, testScore: 60, fitnessScore: 60, docsScore: 60 });
    expect(result.grade).toBe('C');
  });

  it('should grade D for score < 55', () => {
    const result = computeHarnessabilityScore({ typeScore: 0, testScore: 0, fitnessScore: 0, docsScore: 0, namingScore: 0, errorHandlingScore: 0, contextDensityScore: 0 });
    expect(result.grade).toBe('D');
    expect(result.score).toBe(0);
  });

  it('should include breakdown in result with all 7 dimensions', () => {
    const result = computeHarnessabilityScore({ typeScore: 90, testScore: 80, fitnessScore: 70, docsScore: 60, namingScore: 50, errorHandlingScore: 40, contextDensityScore: 30 });
    expect(result.breakdown.types).toEqual({ score: 90, weight: 0.25 });
    expect(result.breakdown.tests).toEqual({ score: 80, weight: 0.25 });
    expect(result.breakdown.fitness).toEqual({ score: 70, weight: 0.15 });
    expect(result.breakdown.docs).toEqual({ score: 60, weight: 0.15 });
    expect(result.breakdown.naming).toEqual({ score: 50, weight: 0.10 });
    expect(result.breakdown.errors).toEqual({ score: 40, weight: 0.05 });
    expect(result.breakdown.context).toEqual({ score: 30, weight: 0.05 });
  });
});
