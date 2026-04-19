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

import { describe, it, expect } from 'vitest';
import { scanTestCoverage } from '../../core/harness/test-coverage-scanner.js';
import { scanNamingClarity } from '../../core/harness/naming-clarity-scanner.js';
import { scanErrorHandling } from '../../core/harness/error-handling-scanner.js';
import { scanContextDensity } from '../../core/harness/context-density-scanner.js';
import type { ViolationDetail } from '../../core/harness/violation-detail.js';

// ── Test Coverage Scanner ────────────────────────────────

describe('Test Coverage Scanner — violations', () => {
  it('should detect missing_test for module without test file', () => {
    const result = scanTestCoverage(
      ['graph-store', 'utils'],
      [{ name: 'graph-store', hasAssertions: true }],
      { collectViolations: true },
    );
    expect(result.violations).toBeDefined();
    const missing = result.violations!.filter((v: ViolationDetail) => v.violationType === 'missing_test');
    expect(missing.length).toBe(1);
    expect(missing[0].file).toContain('utils');
    expect(missing[0].confidence).toBe(1.0);
    expect(missing[0].dimension).toBe('tests');
  });

  it('should detect empty_test for test file with 0 assertions', () => {
    const result = scanTestCoverage(
      ['graph-store'],
      [{ name: 'graph-store', hasAssertions: false }],
      { collectViolations: true },
    );
    const empty = result.violations!.filter((v: ViolationDetail) => v.violationType === 'empty_test');
    expect(empty.length).toBe(1);
    expect(empty[0].confidence).toBe(0.9);
  });

  it('should return no violations when all modules tested', () => {
    const result = scanTestCoverage(
      ['graph-store'],
      [{ name: 'graph-store', hasAssertions: true }],
      { collectViolations: true },
    );
    expect(result.violations!.length).toBe(0);
  });

  it('should omit violations when collectViolations false (backward compat)', () => {
    const result = scanTestCoverage(
      ['graph-store', 'utils'],
      [{ name: 'graph-store', hasAssertions: true }],
    );
    expect(result.violations).toBeUndefined();
  });

  it('should preserve aggregate score when collecting violations', () => {
    const modules = ['a', 'b', 'c'];
    const tests = [{ name: 'a', hasAssertions: true }];
    const with_ = scanTestCoverage(modules, tests, { collectViolations: true });
    const without = scanTestCoverage(modules, tests);
    expect(with_.testScore).toBe(without.testScore);
  });
});

// ── Naming Clarity Scanner ───────────────────────────────

describe('Naming Clarity Scanner — violations', () => {
  it('should detect generic_name with correct line', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'const x = 1;\nconst data = {};\nconst name = "ok";',
    }];
    const result = scanNamingClarity(files, { collectViolations: true });
    expect(result.violations).toBeDefined();
    const generic = result.violations!.filter((v: ViolationDetail) => v.violationType === 'generic_name');
    expect(generic.length).toBe(1);
    expect(generic[0].evidence).toBe('data');
    expect(generic[0].line).toBe(2);
    expect(generic[0].confidence).toBe(1.0);
  });

  it('should detect single_char (non-allowed)', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'const x = 1;\nconst y = 2;',
    }];
    const result = scanNamingClarity(files, { collectViolations: true });
    const singles = result.violations!.filter((v: ViolationDetail) => v.violationType === 'single_char');
    expect(singles.length).toBe(2);
    expect(singles[0].confidence).toBe(0.9);
  });

  it('should NOT flag allowed single chars (i, j, k, e)', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'const i = 0;\nconst j = 1;\nconst k = 2;\nconst e = err;',
    }];
    const result = scanNamingClarity(files, { collectViolations: true });
    expect(result.violations!.length).toBe(0);
  });

  it('should exclude test files', () => {
    const files = [{
      path: 'src/tests/store.test.ts',
      content: 'const data = {};',
    }];
    const result = scanNamingClarity(files, { collectViolations: true });
    expect(result.violations!.length).toBe(0);
  });

  it('should omit violations when not collecting (backward compat)', () => {
    const files = [{ path: 'a.ts', content: 'const data = {};' }];
    const result = scanNamingClarity(files);
    expect(result.violations).toBeUndefined();
  });
});

// ── Error Handling Scanner ───────────────────────────────

describe('Error Handling Scanner — violations', () => {
  it('should detect raw_throw without typed-errors import', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'const x = 1;\nthrow new Error("oops");\nconst y = 2;',
    }];
    const result = scanErrorHandling(files, { collectViolations: true });
    expect(result.violations).toBeDefined();
    const raw = result.violations!.filter((v: ViolationDetail) => v.violationType === 'raw_throw');
    expect(raw.length).toBe(1);
    expect(raw[0].line).toBe(2);
    expect(raw[0].confidence).toBe(1.0);
  });

  it('should NOT flag throw when file has typed-errors import', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'import { AppError } from "../utils/errors.js";\nthrow new Error("oops");',
    }];
    const result = scanErrorHandling(files, { collectViolations: true });
    const raw = result.violations!.filter((v: ViolationDetail) => v.violationType === 'raw_throw');
    expect(raw.length).toBe(0);
  });

  it('should detect swallowed_catch', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'try { x(); } catch (e) {}',
    }];
    const result = scanErrorHandling(files, { collectViolations: true });
    const swallowed = result.violations!.filter((v: ViolationDetail) => v.violationType === 'swallowed_catch');
    expect(swallowed.length).toBe(1);
  });

  it('should detect console_error in non-test file', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'console.error("bad");\nconsole.warn("hmm");',
    }];
    const result = scanErrorHandling(files, { collectViolations: true });
    const ce = result.violations!.filter((v: ViolationDetail) => v.violationType === 'console_error');
    expect(ce.length).toBe(2);
  });

  it('should NOT flag console.error in test file', () => {
    const files = [{
      path: 'src/tests/store.test.ts',
      content: 'console.error("test output");',
    }];
    const result = scanErrorHandling(files, { collectViolations: true });
    const ce = result.violations!.filter((v: ViolationDetail) => v.violationType === 'console_error');
    expect(ce.length).toBe(0);
  });

  it('should omit violations when not collecting (backward compat)', () => {
    const files = [{ path: 'a.ts', content: 'throw new Error("x");' }];
    const result = scanErrorHandling(files);
    expect(result.violations).toBeUndefined();
  });
});

// ── Context Density Scanner ──────────────────────────────

describe('Context Density Scanner — violations', () => {
  it('should detect missing_jsdoc on exported function', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: 'const x = 1;\nexport function foo(): void {}\nconst y = 2;',
    }];
    const result = scanContextDensity(files, { collectViolations: true });
    expect(result.violations).toBeDefined();
    const missing = result.violations!.filter((v: ViolationDetail) => v.violationType === 'missing_jsdoc');
    expect(missing.length).toBe(1);
    expect(missing[0].line).toBe(2);
    expect(missing[0].confidence).toBe(1.0);
  });

  it('should NOT flag documented export', () => {
    const files = [{
      path: 'src/core/store.ts',
      content: '/** Does foo */\nexport function foo(): void {}',
    }];
    const result = scanContextDensity(files, { collectViolations: true });
    expect(result.violations!.length).toBe(0);
  });

  it('should exclude test files', () => {
    const files = [{
      path: 'src/tests/store.test.ts',
      content: 'export function foo(): void {}',
    }];
    const result = scanContextDensity(files, { collectViolations: true });
    expect(result.violations!.length).toBe(0);
  });

  it('should omit violations when not collecting (backward compat)', () => {
    const files = [{ path: 'a.ts', content: 'export function foo(): void {}' }];
    const result = scanContextDensity(files);
    expect(result.violations).toBeUndefined();
  });
});
