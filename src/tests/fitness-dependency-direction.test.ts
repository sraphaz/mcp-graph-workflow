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
 * TDD tests for Fitness Function: Dependency Direction
 * Task 2.1: Verify core/ doesn't import from cli/, mcp/, api/, web/
 */
import { describe, it, expect } from 'vitest';
import { checkDependencyDirection } from '../core/harness/fitness-functions.js';

describe('Fitness: Dependency Direction', () => {
  it('should pass when no violations exist', () => {
    const files = [
      { path: 'src/core/store/sqlite-store.ts', content: 'import { z } from "zod/v4";\nimport { logger } from "../utils/logger.js";' },
      { path: 'src/core/utils/errors.ts', content: 'export class AppError extends Error {}' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should detect core/ importing from mcp/', () => {
    const files = [
      { path: 'src/core/planner/next-task.ts', content: 'import { toolHandler } from "../../mcp/tools/index.js";' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toContain('core/');
    expect(result.violations[0].importPath).toContain('mcp/');
  });

  it('should detect core/ importing from cli/', () => {
    const files = [
      { path: 'src/core/store/store-manager.ts', content: 'import { runCommand } from "../../cli/commands/run.js";' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.passed).toBe(false);
    expect(result.violations[0].importPath).toContain('cli/');
  });

  it('should detect schemas/ importing from core/', () => {
    const files = [
      { path: 'src/schemas/node.schema.ts', content: 'import { SqliteStore } from "../core/store/sqlite-store.js";' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
  });

  it('should allow core/ importing from schemas/', () => {
    const files = [
      { path: 'src/core/store/sqlite-store.ts', content: 'import { NodeSchema } from "../../schemas/node.schema.js";' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.passed).toBe(true);
  });

  it('should return checkedFiles count', () => {
    const files = [
      { path: 'src/core/a.ts', content: '' },
      { path: 'src/core/b.ts', content: '' },
      { path: 'src/mcp/c.ts', content: '' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.checkedFiles).toBe(3);
  });

  it('should ignore files outside src/', () => {
    const files = [
      { path: 'tests/helpers/factories.ts', content: 'import { foo } from "../../src/mcp/tools/index.js";' },
    ];
    const result = checkDependencyDirection(files);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
