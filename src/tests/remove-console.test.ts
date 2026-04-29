/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05f — remove-console tests.
 */

import { describe, it, expect } from "vitest";
import { removeConsole } from "../core/llm/boosters/remove-console.js";

describe("remove-console (E6.T05f)", () => {
  it("drops console.log lines silently", () => {
    const r = removeConsole("console.log('hi');");
    expect(r.removed).toBe(1);
    expect(r.upgraded).toBe(0);
    expect(r.output.trim()).toBe("");
  });

  it("drops console.debug + console.info + console.trace", () => {
    const src = `console.debug('a');\nconsole.info('b');\nconsole.trace();`;
    const r = removeConsole(src);
    expect(r.removed).toBe(3);
    expect(r.upgraded).toBe(0);
  });

  it("upgrades console.warn → logger.warn", () => {
    const r = removeConsole("console.warn('bad');");
    expect(r.upgraded).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.output).toContain("logger.warn('bad');");
  });

  it("upgrades console.error → logger.error", () => {
    const r = removeConsole("console.error('crash');");
    expect(r.upgraded).toBe(1);
    expect(r.output).toContain("logger.error('crash');");
  });

  it("adds logger import when upgrade happens and import missing", () => {
    const r = removeConsole("console.error('x');");
    expect(r.loggerImportAdded).toBe(true);
    expect(r.output).toContain('import { logger } from "../utils/logger.js"');
  });

  it("does NOT duplicate logger import when already present", () => {
    const src = [
      `import { logger } from "../utils/logger.js";`,
      `console.error('x');`,
    ].join("\n");
    const r = removeConsole(src);
    expect(r.loggerImportAdded).toBe(false);
    const imports = r.output.match(/import \{ logger \}/g) ?? [];
    expect(imports).toHaveLength(1);
  });

  it("custom loggerImport path used when provided", () => {
    const r = removeConsole("console.warn('x');", {
      loggerImport: '"@app/logger.js"',
    });
    expect(r.output).toContain('"@app/logger.js"');
  });

  it("compact output: collapses 3+ newlines after drops", () => {
    const src = `const a = 1;\nconsole.log('x');\nconsole.log('y');\nconsole.log('z');\nconst b = 2;`;
    const r = removeConsole(src);
    expect(r.output).not.toMatch(/\n{3,}/);
  });

  it("preserves non-console lines verbatim", () => {
    const src = `function foo() {\n  console.log('bye');\n  return 42;\n}`;
    const r = removeConsole(src);
    expect(r.output).toContain("function foo()");
    expect(r.output).toContain("return 42;");
    expect(r.output).not.toContain("console.log");
  });

  it("idempotent: running twice yields the same output", () => {
    const src = `console.log('a');\nconsole.warn('b');`;
    const once = removeConsole(src).output;
    const twice = removeConsole(once).output;
    expect(twice).toBe(once);
  });
});
