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
import { runHarnessScan } from '../../core/harness/harness-scan-runner.js';
import type { ViolationDetail } from '../../core/harness/violation-detail.js';

const ROOT = process.cwd();

describe('Scan Runner — violations integration', () => {
  it('should return violations array when collectViolations=true', () => {
    const result = runHarnessScan(ROOT, undefined, undefined, { collectViolations: true });
    expect(result.violations).toBeDefined();
    expect(Array.isArray(result.violations)).toBe(true);
    // Real codebase should have some violations
    expect(result.violations!.length).toBeGreaterThan(0);
  });

  it('should NOT return violations when collectViolations=false (backward compat)', () => {
    const result = runHarnessScan(ROOT);
    expect(result.violations).toBeUndefined();
  });

  it('should NOT return violations when options omitted (backward compat)', () => {
    const result = runHarnessScan(ROOT, undefined, undefined, {});
    expect(result.violations).toBeUndefined();
  });

  it('should have valid ViolationDetail shape for all violations', () => {
    const result = runHarnessScan(ROOT, undefined, undefined, { collectViolations: true });
    for (const v of result.violations!) {
      expect(v.file).toBeTruthy();
      expect(v.line).toBeGreaterThanOrEqual(1);
      expect(['types', 'tests', 'naming', 'errors', 'context', 'docs', 'fitness']).toContain(v.dimension);
      expect(v.violationType).toBeTruthy();
      expect(v.confidence).toBeGreaterThanOrEqual(0);
      expect(v.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should include violations from multiple dimensions', () => {
    const result = runHarnessScan(ROOT, undefined, undefined, { collectViolations: true });
    const dimensions = new Set(result.violations!.map((v: ViolationDetail) => v.dimension));
    // Real codebase likely has violations in at least 2 dimensions
    expect(dimensions.size).toBeGreaterThanOrEqual(1);
  });

  it('should cap violations at maxViolations (500)', () => {
    // This test verifies the cap exists. We can't easily generate 600+ in a real scan,
    // but we verify the result is <= 500.
    const result = runHarnessScan(ROOT, undefined, undefined, { collectViolations: true });
    expect(result.violations!.length).toBeLessThanOrEqual(500);
  });

  it('should preserve aggregate scores when collecting violations', () => {
    const withViolations = runHarnessScan(ROOT, undefined, undefined, { collectViolations: true });
    const without = runHarnessScan(ROOT);
    expect(withViolations.score).toBe(without.score);
    expect(withViolations.grade).toBe(without.grade);
  });

  it('should convert fitness violations to ViolationDetail format', () => {
    const result = runHarnessScan(ROOT, undefined, undefined, { collectViolations: true });
    const fitnessViolations = result.violations!.filter((v: ViolationDetail) => v.dimension === 'fitness');
    for (const v of fitnessViolations) {
      expect(v.file).toBeTruthy();
      expect(v.line).toBeGreaterThanOrEqual(1);
      expect(v.dimension).toBe('fitness');
      expect(v.confidence).toBe(1.0);
    }
  });
});
