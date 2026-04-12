/**
 * TDD tests for Test Coverage Scanner (Harnessability Metric)
 * Task 3.2: Test Coverage Scanner
 */
import { describe, it, expect } from 'vitest';
import { scanTestCoverage } from '../core/harness/test-coverage-scanner.js';

describe('TestCoverageScanner', () => {
  it('should return 100% when all modules have tests', () => {
    const modules = ['store', 'parser', 'search'];
    const testFiles = [
      { name: 'store.test.ts', hasAssertions: true },
      { name: 'parser.test.ts', hasAssertions: true },
      { name: 'search.test.ts', hasAssertions: true },
    ];
    const result = scanTestCoverage(modules, testFiles);
    expect(result.testScore).toBe(100);
    expect(result.totalModules).toBe(3);
    expect(result.testedModules).toBe(3);
  });

  it('should return 80% when 4/5 modules have tests', () => {
    const modules = ['store', 'parser', 'search', 'rag', 'planner'];
    const testFiles = [
      { name: 'store.test.ts', hasAssertions: true },
      { name: 'parser.test.ts', hasAssertions: true },
      { name: 'search.test.ts', hasAssertions: true },
      { name: 'rag.test.ts', hasAssertions: true },
    ];
    const result = scanTestCoverage(modules, testFiles);
    expect(result.testScore).toBe(80);
    expect(result.testedModules).toBe(4);
  });

  it('should not count test files without assertions as covered', () => {
    const modules = ['store', 'parser'];
    const testFiles = [
      { name: 'store.test.ts', hasAssertions: true },
      { name: 'parser.test.ts', hasAssertions: false },
    ];
    const result = scanTestCoverage(modules, testFiles);
    expect(result.testScore).toBe(50);
    expect(result.testedModules).toBe(1);
    expect(result.emptyTests).toBe(1);
  });

  it('should match module names with various test naming patterns', () => {
    const modules = ['sqlite-store', 'bm25-compressor'];
    const testFiles = [
      { name: 'sqlite-store.test.ts', hasAssertions: true },
      { name: 'bm25-compressor.test.ts', hasAssertions: true },
    ];
    const result = scanTestCoverage(modules, testFiles);
    expect(result.testScore).toBe(100);
  });

  it('should handle empty inputs', () => {
    const result = scanTestCoverage([], []);
    expect(result.testScore).toBe(100);
    expect(result.totalModules).toBe(0);
  });

  it('should return correct structure', () => {
    const result = scanTestCoverage(['a'], []);
    expect(result).toHaveProperty('testScore');
    expect(result).toHaveProperty('totalModules');
    expect(result).toHaveProperty('testedModules');
    expect(result).toHaveProperty('emptyTests');
  });
});
