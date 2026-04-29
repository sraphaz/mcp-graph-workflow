/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05c — add-error-handling tests.
 */

import { describe, it, expect } from "vitest";
import { addErrorHandling } from "../core/llm/boosters/add-error-handling.js";

describe("add-error-handling (E6.T05c)", () => {
  it("rewrites top-level 'throw new Error(...)' to McpGraphError", () => {
    const r = addErrorHandling(`throw new Error("boom");`);
    expect(r.rewritten).toBe(1);
    expect(r.output).toContain('throw new McpGraphError("boom");');
  });

  it("auto-imports McpGraphError when rewriting and import missing", () => {
    const r = addErrorHandling(`throw new Error("x");`);
    expect(r.importAdded).toBe(true);
    expect(r.output).toContain('import { McpGraphError } from "../utils/errors.js"');
  });

  it("does not duplicate import when already present", () => {
    const src = [
      `import { McpGraphError } from "../utils/errors.js";`,
      `throw new Error("x");`,
    ].join("\n");
    const r = addErrorHandling(src);
    expect(r.importAdded).toBe(false);
    const occurrences = r.output.match(/import \{ McpGraphError \}/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it("custom errorImportPath honored", () => {
    const r = addErrorHandling(`throw new Error("x");`, {
      errorImportPath: '"@app/errors.js"',
    });
    expect(r.output).toContain('"@app/errors.js"');
  });

  it("skips throws already inside try/catch", () => {
    const src = `try {\n  throw new Error("inside");\n} catch (e) {}`;
    const r = addErrorHandling(src);
    expect(r.rewritten).toBe(0);
    expect(r.output).toBe(src);
  });

  it("rewrites multiple throws in a single source", () => {
    const src = `throw new Error("a");\nthrow new Error("b");`;
    const r = addErrorHandling(src);
    expect(r.rewritten).toBe(2);
    expect(r.output).toContain('throw new McpGraphError("a");');
    expect(r.output).toContain('throw new McpGraphError("b");');
  });

  it("preserves indentation", () => {
    const r = addErrorHandling(`  throw new Error("indented");`);
    expect(r.output).toContain('  throw new McpGraphError("indented");');
  });

  it("does nothing when source has no raw throw", () => {
    const src = `function noop() { return 1; }`;
    const r = addErrorHandling(src);
    expect(r.rewritten).toBe(0);
    expect(r.output).toBe(src);
  });

  it("idempotent: running on already-McpGraphError output adds nothing", () => {
    const once = addErrorHandling(`throw new Error("x");`).output;
    const twice = addErrorHandling(once);
    expect(twice.rewritten).toBe(0);
    expect(twice.output).toBe(once);
  });
});
