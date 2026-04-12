/**
 * Test Coverage Scanner — Harnessability Metric dimension
 *
 * Counts source modules that have corresponding test files with assertions.
 * Score: (tested modules / total modules) * 100.
 *
 * Part of the Harnessability Metric (Harness Engineering).
 */

export interface TestCoverageResult {
  testScore: number;
  totalModules: number;
  testedModules: number;
  emptyTests: number;
}

export interface TestFileInfo {
  name: string;
  hasAssertions: boolean;
}

/**
 * Scan test coverage: match module names to test file names.
 * Only counts test files with assertions (hasAssertions=true) as covered.
 */
export function scanTestCoverage(
  moduleNames: string[],
  testFiles: TestFileInfo[],
): TestCoverageResult {
  if (moduleNames.length === 0) {
    return { testScore: 100, totalModules: 0, testedModules: 0, emptyTests: 0 };
  }

  // Build set of test stems with assertions
  const testedStems = new Set<string>();
  let emptyTests = 0;

  for (const tf of testFiles) {
    const stem = tf.name.replace(/\.test\.ts$/, '').replace(/\.bench\.ts$/, '');
    if (tf.hasAssertions) {
      testedStems.add(stem);
    } else {
      emptyTests++;
    }
  }

  // Match modules to tests
  let testedModules = 0;
  for (const mod of moduleNames) {
    // Try exact match and common variations
    if (
      testedStems.has(mod) ||
      testedStems.has(mod.replace(/_/g, '-')) ||
      testedStems.has(mod.replace(/-/g, '_'))
    ) {
      testedModules++;
    }
  }

  const testScore = Math.round((testedModules / moduleNames.length) * 100);

  return {
    testScore,
    totalModules: moduleNames.length,
    testedModules,
    emptyTests,
  };
}
