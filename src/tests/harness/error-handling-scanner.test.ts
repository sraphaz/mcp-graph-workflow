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
 * TDD: Task 2.2 — error-handling-scanner.ts
 *
 * Scanner detects poor error handling patterns:
 * - Raw throws: `throw new Error("string")` without typed error class
 * - Swallowed catch blocks: empty catch or catch with no log/rethrow
 * - console.error/warn usage outside test files (should use logger)
 *
 * Files that import from the typed errors module are considered "handled".
 * Score = % of error sites handled correctly (0–100).
 */
import { describe, it, expect } from "vitest";
import {
  scanErrorHandling,
  type ErrorHandlingResult,
} from "../../core/harness/error-handling-scanner.js";
import type { FileContent } from "../../core/harness/type-coverage-scanner.js";

describe("scanErrorHandling", () => {
  it("should return errorHandlingScore=100 and zeros for empty file list", () => {
    const result: ErrorHandlingResult = scanErrorHandling([]);
    expect(result.errorHandlingScore).toBe(100);
    expect(result.totalErrorSites).toBe(0);
    expect(result.rawThrows).toBe(0);
    expect(result.swallowedCatches).toBe(0);
  });

  it("should flag raw throw new Error() and penalize score", () => {
    const files: FileContent[] = [
      {
        path: "src/service.ts",
        content: `
function doWork() {
  throw new Error("operation failed");
}
`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.rawThrows).toBeGreaterThanOrEqual(1);
    expect(result.errorHandlingScore).toBeLessThan(100);
  });

  it("should NOT penalize files that import from utils/errors.js", () => {
    const files: FileContent[] = [
      {
        path: "src/service.ts",
        content: `
import { AppError } from "../../utils/errors.js";

function doWork() {
  throw new AppError("operation failed");
}
`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.rawThrows).toBe(0);
    expect(result.errorHandlingScore).toBe(100);
  });

  it("should flag empty catch blocks as swallowed errors", () => {
    const files: FileContent[] = [
      {
        path: "src/handler.ts",
        content: `
try {
  run();
} catch (_e) {}
`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.swallowedCatches).toBeGreaterThanOrEqual(1);
    expect(result.errorHandlingScore).toBeLessThan(100);
  });

  it("should NOT flag catch blocks that call logger.error", () => {
    const files: FileContent[] = [
      {
        path: "src/handler.ts",
        content: `
try {
  run();
} catch (err) {
  logger.error("msg", { err });
}
`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.swallowedCatches).toBe(0);
    expect(result.errorHandlingScore).toBe(100);
  });

  it("should flag console.error usage in non-test files", () => {
    const files: FileContent[] = [
      {
        path: "src/utils.ts",
        content: `
function handleErr(e: Error) {
  console.error("failed", e);
}
`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.consoleErrors).toBeGreaterThanOrEqual(1);
    expect(result.errorHandlingScore).toBeLessThan(100);
  });

  it("should NOT flag console.error in test files", () => {
    const files: FileContent[] = [
      {
        path: "src/utils.test.ts",
        content: `console.error("debug output");`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.consoleErrors).toBe(0);
    expect(result.errorHandlingScore).toBe(100);
  });

  it("should score 100 for file using logger.error and typed errors", () => {
    const files: FileContent[] = [
      {
        path: "src/good.ts",
        content: `
import { AppError } from "../../utils/errors.js";

try {
  doWork();
} catch (err) {
  logger.error("failed", { err });
  throw new AppError("typed error");
}
`,
      },
    ];
    const result = scanErrorHandling(files);
    expect(result.errorHandlingScore).toBe(100);
    expect(result.rawThrows).toBe(0);
    expect(result.swallowedCatches).toBe(0);
  });
});
