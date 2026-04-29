/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-9.T04 — zoom-out analyzer tests.
 */

import { describe, it, expect } from "vitest";
import {
  analyzeZoomOut,
  buildMermaid,
  CENTRAL_FAN_IN_THRESHOLD,
} from "../core/analyzer/zoom-out.js";

describe("zoom-out (E9.T04)", () => {
  it("CENTRAL_FAN_IN_THRESHOLD = 5", () => {
    expect(CENTRAL_FAN_IN_THRESHOLD).toBe(5);
  });

  it("computes fanIn/fanOut from edges", () => {
    const r = analyzeZoomOut(
      ["a.ts", "b.ts", "c.ts"],
      [
        { from: "a.ts", to: "b.ts" },
        { from: "a.ts", to: "c.ts" },
        { from: "c.ts", to: "b.ts" },
      ],
    );
    const a = r.nodes.find((n) => n.file === "a.ts")!;
    const b = r.nodes.find((n) => n.file === "b.ts")!;
    expect(a).toEqual({ file: "a.ts", fanIn: 0, fanOut: 2 });
    expect(b).toEqual({ file: "b.ts", fanIn: 2, fanOut: 0 });
  });

  it("detects central modules with fanIn >= threshold", () => {
    const importers = Array.from({ length: 6 }, (_, i) => `caller${i}.ts`);
    const edges = importers.map((f) => ({ from: f, to: "core.ts" }));
    const r = analyzeZoomOut([...importers, "core.ts"], edges);
    expect(r.central).toContain("core.ts");
  });

  it("does NOT mark central below threshold", () => {
    const r = analyzeZoomOut(
      ["a.ts", "b.ts"],
      [{ from: "a.ts", to: "b.ts" }],
    );
    expect(r.central).toEqual([]);
  });

  it("detects leaf modules: fanOut=0 AND fanIn>0", () => {
    const r = analyzeZoomOut(
      ["root.ts", "leaf.ts"],
      [{ from: "root.ts", to: "leaf.ts" }],
    );
    expect(r.leaves).toContain("leaf.ts");
    expect(r.leaves).not.toContain("root.ts");
  });

  it("detects isolated islands: fanIn=0 AND fanOut=0", () => {
    const r = analyzeZoomOut(
      ["island.ts", "a.ts", "b.ts"],
      [{ from: "a.ts", to: "b.ts" }],
    );
    expect(r.islands).toEqual(["island.ts"]);
  });

  it("buildMermaid produces graph TD with declarations + edges", () => {
    const md = buildMermaid(
      [
        { file: "src/a.ts", fanIn: 0, fanOut: 1 },
        { file: "src/b.ts", fanIn: 1, fanOut: 0 },
      ],
      [{ from: "src/a.ts", to: "src/b.ts" }],
    );
    expect(md).toContain("graph TD");
    expect(md).toContain('"src/a.ts"');
    expect(md).toContain('"src/b.ts"');
    expect(md).toMatch(/-->/);
  });

  it("buildMermaid skips edges referencing unknown files", () => {
    const md = buildMermaid(
      [{ file: "a.ts", fanIn: 0, fanOut: 0 }],
      [{ from: "a.ts", to: "ghost.ts" }],
    );
    expect(md.split("-->").length).toBe(1);
  });

  it("custom centralThreshold honored", () => {
    const r = analyzeZoomOut(
      ["core.ts", "x.ts", "y.ts"],
      [
        { from: "x.ts", to: "core.ts" },
        { from: "y.ts", to: "core.ts" },
      ],
      2,
    );
    expect(r.central).toContain("core.ts");
  });
});
