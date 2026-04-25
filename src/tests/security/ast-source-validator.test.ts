/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import { validateSource } from "../../core/security/ast-source-validator.js";

describe("validateSource — allows safe helpers", () => {
  it("accepts a plain async function expression", () => {
    const source = "async (cdp, { url }) => { await cdp.send('Page.navigate', { url }); return { ok: true }; }";
    const result = validateSource(source);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("accepts arrow functions with local vars and loops", () => {
    const source = `async (cdp, { count }) => {
      let total = 0;
      for (let i = 0; i < count; i++) total += i;
      return { ok: true, total };
    }`;
    expect(validateSource(source).ok).toBe(true);
  });

  it("accepts JSON.parse and Math calls", () => {
    const source = "async (cdp, args) => { const n = Math.max(1, args.n); return JSON.parse(JSON.stringify({ n })); }";
    expect(validateSource(source).ok).toBe(true);
  });
});

describe("validateSource — rejects forbidden identifiers", () => {
  const CASES: Array<{ name: string; source: string }> = [
    { name: "process direct", source: "async () => process.exit(0)" },
    { name: "require call", source: "async () => { const fs = require('fs'); return fs; }" },
    { name: "import.meta", source: "async () => import.meta.url" },
    { name: "eval", source: "async () => eval('1+1')" },
    { name: "Function ctor", source: "async () => new Function('return 1')" },
    { name: "global.fs", source: "async () => { return global.fs; }" },
    { name: "globalThis.process", source: "async () => globalThis.process.env" },
    { name: "dynamic import", source: "async () => (await import('fs')).readFileSync" },
    { name: "__proto__", source: "async (cdp, a) => { a.__proto__.leak = 1; return a; }" },
    { name: "constructor.constructor bypass", source: "async (cdp, a) => a.constructor.constructor('return process')()" },
  ];

  for (const c of CASES) {
    it(`blocks: ${c.name}`, () => {
      const result = validateSource(c.source);
      expect(result.ok).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  }
});

describe("validateSource — rejects obfuscation bypasses", () => {
  it("blocks globalThis['pro'+'cess']", () => {
    const source = "async () => globalThis['pro'+'cess'].exit(0)";
    expect(validateSource(source).ok).toBe(false);
  });

  it("blocks bracket access to a banned identifier via string concat", () => {
    const source = "async () => globalThis['re' + 'quire']('fs')";
    expect(validateSource(source).ok).toBe(false);
  });
});

describe("validateSource — input hygiene", () => {
  it("rejects malformed TypeScript/JS", () => {
    const source = "async ( => { not valid";
    const result = validateSource(source);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.kind === "parse")).toBe(true);
  });

  it("rejects oversized sources", () => {
    const source = "async () => {" + "'x';".repeat(5000) + "}";
    const result = validateSource(source, { maxBytes: 4096 });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.kind === "size")).toBe(true);
  });
});
