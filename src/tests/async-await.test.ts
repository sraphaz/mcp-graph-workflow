/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-6.T05d — async-await booster tests.
 */

import { describe, it, expect } from "vitest";
import { asyncAwait } from "../core/llm/boosters/async-await.js";

describe("async-await (E6.T05d)", () => {
  it("rewrites simple .then(arrow) to await + return", () => {
    const src = `  return fetchUser(id).then((u) => u.name);`;
    const r = asyncAwait(src);
    expect(r.rewritten).toBe(1);
    expect(r.output).toContain(`const u = await fetchUser(id);`);
    expect(r.output).toContain(`return u.name;`);
  });

  it("preserves Promise.all() chains (no rewrite)", () => {
    const src = `return Promise.all(items).then((rs) => rs.length);`;
    const r = asyncAwait(src);
    expect(r.rewritten).toBe(0);
    expect(r.skippedChains).toBe(1);
    expect(r.preservedPromiseAll).toBe(true);
    expect(r.output).toBe(src);
  });

  it("preserves Promise.race / Promise.allSettled / Promise.any chains", () => {
    for (const variant of [
      `return Promise.race(items).then((x) => x);`,
      `return Promise.allSettled(items).then((x) => x);`,
      `return Promise.any(items).then((x) => x);`,
    ]) {
      const r = asyncAwait(variant);
      expect(r.rewritten).toBe(0);
      expect(r.output).toBe(variant);
    }
  });

  it("skips chains with .catch / .finally (out-of-scope safety)", () => {
    const src = `return load().then((x) => x).catch((e) => null);`;
    const r = asyncAwait(src);
    expect(r.rewritten).toBe(0);
    expect(r.output).toBe(src);
  });

  it("returns 0 rewrites when source has no .then() patterns", () => {
    const src = `function add(a: number, b: number) { return a + b; }`;
    const r = asyncAwait(src);
    expect(r.rewritten).toBe(0);
    expect(r.output).toBe(src);
  });

  it("preserves indentation in the rewrite", () => {
    const src = `    return getX().then((x) => x);`;
    const r = asyncAwait(src);
    expect(r.output).toContain(`    const x = await getX();`);
    expect(r.output).toContain(`    return x;`);
  });

  it("rewrites multiple matching lines", () => {
    const src = [
      `return foo().then((a) => a);`,
      `return bar().then((b) => b);`,
    ].join("\n");
    const r = asyncAwait(src);
    expect(r.rewritten).toBe(2);
  });
});
