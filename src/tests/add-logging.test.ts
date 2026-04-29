/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05e — add-logging tests.
 */

import { describe, it, expect } from "vitest";
import { addLogging } from "../core/llm/boosters/add-logging.js";

describe("add-logging (E6.T05e)", () => {
  it("inserts logger.debug at start of an exported async function with no logging", () => {
    const src = `export async function fetchUser(id: string) {\n  return { id };\n}`;
    const r = addLogging(src, { moduleTag: "users" });
    expect(r.added).toBe(1);
    expect(r.output).toMatch(/logger\.debug\("users:fetchUser", \{ id \}\);/);
  });

  it("emits empty fields {} when function has no params", () => {
    const src = `export async function init() {\n  return 1;\n}`;
    const r = addLogging(src, { moduleTag: "x" });
    expect(r.output).toContain('logger.debug("x:init", {})');
  });

  it("strips type annotations from param names", () => {
    const src = `export async function fn(a: number, b: string[]) {\n  return a;\n}`;
    const r = addLogging(src);
    expect(r.output).toContain("{ a, b }");
  });

  it("ignores default values + rest spread when listing params", () => {
    const src = `export async function fn(a = 1, ...rest: string[]) {\n  return a;\n}`;
    const r = addLogging(src);
    expect(r.output).toContain("{ a, rest }");
  });

  it("skips functions whose body already contains logger.<method>(", () => {
    const src = `export async function fn() {\n  logger.warn("already");\n  return 1;\n}`;
    const r = addLogging(src);
    expect(r.added).toBe(0);
    expect(r.output).toBe(src);
  });

  it("does not log unexported functions or sync functions", () => {
    const src = `async function privateFn() {\n  return 1;\n}\nexport function syncFn() {\n  return 2;\n}`;
    const r = addLogging(src);
    expect(r.added).toBe(0);
  });

  it("adds logger import when added > 0 and import missing", () => {
    const src = `export async function fn() { return 1; }`;
    const r = addLogging(src);
    expect(r.loggerImportAdded).toBe(true);
    expect(r.output).toContain('import { logger } from "../utils/logger.js"');
  });

  it("does not add duplicate logger import when already present", () => {
    const src = `import { logger } from "../utils/logger.js";\nexport async function fn() { return 1; }`;
    const r = addLogging(src);
    expect(r.loggerImportAdded).toBe(false);
    const imports = r.output.match(/import \{ logger \}/g) ?? [];
    expect(imports).toHaveLength(1);
  });

  it("processes multiple exported async functions in one source", () => {
    const src = [
      `export async function a(x: number) { return x; }`,
      `export async function b() { return 1; }`,
    ].join("\n");
    const r = addLogging(src, { moduleTag: "mod" });
    expect(r.added).toBe(2);
    expect(r.output).toContain('"mod:a"');
    expect(r.output).toContain('"mod:b"');
  });

  it("idempotent: re-running on already-logged source adds nothing", () => {
    const src = `export async function fn() { return 1; }`;
    const once = addLogging(src).output;
    const twice = addLogging(once);
    expect(twice.added).toBe(0);
    expect(twice.output).toBe(once);
  });
});
