/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05b — add-types booster tests.
 */

import { describe, it, expect } from "vitest";
import { addTypes } from "../core/llm/boosters/add-types.js";

describe("add-types (E6.T05b)", () => {
  it("infers number from numeric literal default", () => {
    const src = `function inc(n = 1) { return n + 1; }`;
    const r = addTypes(src);
    expect(r.added).toBe(1);
    expect(r.output).toContain(`n: number = 1`);
  });

  it("infers string from string literal default", () => {
    const src = `function greet(name = "world") { return name; }`;
    const r = addTypes(src);
    expect(r.added).toBe(1);
    expect(r.output).toContain(`name: string = "world"`);
  });

  it("infers boolean from boolean literal default", () => {
    const src = `function flag(on = true) { return on; }`;
    const r = addTypes(src);
    expect(r.added).toBe(1);
    expect(r.output).toContain(`on: boolean = true`);
  });

  it("skips params already annotated", () => {
    const src = `function inc(n: number = 1) { return n + 1; }`;
    const r = addTypes(src);
    expect(r.added).toBe(0);
    expect(r.output).toBe(src);
    expect(r.alreadyTyped).toBe(true);
  });

  it("skips JSDoc-only files", () => {
    const src = `/**\n * @param {number} n\n */\nfunction inc(n = 1) { return n + 1; }`;
    const r = addTypes(src);
    expect(r.added).toBe(0);
    expect(r.skippedJsdoc).toBe(true);
  });

  it("does not infer when default is non-literal", () => {
    const src = `function f(x = compute()) { return x; }`;
    const r = addTypes(src);
    expect(r.added).toBe(0);
    expect(r.output).toBe(src);
  });

  it("processes multiple params; only typed ones are inferable", () => {
    const src = `function f(a = 1, b = "x", c = compute(), d = false) { return a; }`;
    const r = addTypes(src);
    expect(r.added).toBe(3);
    expect(r.output).toContain(`a: number = 1`);
    expect(r.output).toContain(`b: string = "x"`);
    expect(r.output).toContain(`c = compute()`);
    expect(r.output).toContain(`d: boolean = false`);
  });

  it("returns 0 when source has no inferable params", () => {
    const src = `function f(x, y) { return x + y; }`;
    const r = addTypes(src);
    expect(r.added).toBe(0);
    expect(r.output).toBe(src);
  });

  it("works with arrow functions", () => {
    const src = `const inc = (n = 1) => n + 1;`;
    const r = addTypes(src);
    expect(r.added).toBe(1);
    expect(r.output).toContain(`n: number = 1`);
  });
});
