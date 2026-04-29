/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T05 — adr-store tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  adrCreate,
  adrList,
  buildAdrBody,
  nextAdrNumber,
  slugify,
} from "../core/knowledge/adr-store.js";

describe("adr-store (E8.T05)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "adr-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("slugify lowercases, replaces non-alnum with hyphens, trims", () => {
    expect(slugify("Use Bun for runtime")).toBe("use-bun-for-runtime");
    expect(slugify("  Hello World!!  ")).toBe("hello-world");
    expect(slugify("Prefer SQLite over PostgreSQL?")).toBe("prefer-sqlite-over-postgresql");
  });

  it("nextAdrNumber returns 1 on empty dir", () => {
    expect(nextAdrNumber([])).toBe(1);
  });

  it("nextAdrNumber increments past max in filenames", () => {
    expect(nextAdrNumber(["2026-04-29-adr-0001-foo.md", "2026-04-29-adr-0042-bar.md"])).toBe(43);
  });

  it("buildAdrBody emits front matter + standard sections", () => {
    const body = buildAdrBody(
      {
        title: "Use Bun",
        decision: "Adopt Bun runtime.",
        consequences: "Faster cold start.",
        context: "Node startup is slow.",
        status: "Accepted",
        date: new Date("2026-04-29T00:00:00Z"),
      },
      7,
    );
    expect(body).toContain("number: 7");
    expect(body).toContain("title: Use Bun");
    expect(body).toContain("date: 2026-04-29");
    expect(body).toContain("status: Accepted");
    expect(body).toContain("## Status");
    expect(body).toContain("## Context");
    expect(body).toContain("## Decision");
    expect(body).toContain("## Consequences");
    expect(body).toContain("Adopt Bun runtime.");
  });

  it("adrCreate writes file with date-adr-NNNN-slug.md filename", () => {
    const result = adrCreate(
      {
        title: "Use Bun for runtime",
        decision: "We adopt Bun.",
        consequences: "Less cold start.",
        date: new Date("2026-04-29T00:00:00Z"),
      },
      dir,
    );
    expect(result.number).toBe(1);
    expect(result.filename).toBe("2026-04-29-adr-0001-use-bun-for-runtime.md");
    const content = readFileSync(result.path, "utf-8");
    expect(content).toContain("# ADR-0001: Use Bun for runtime");
  });

  it("adrCreate auto-increments when same date already has ADRs", () => {
    adrCreate(
      { title: "First", decision: "x", consequences: "y", date: new Date("2026-04-29T00:00:00Z") },
      dir,
    );
    const second = adrCreate(
      { title: "Second", decision: "x", consequences: "y", date: new Date("2026-04-29T00:00:00Z") },
      dir,
    );
    expect(second.number).toBe(2);
    expect(second.filename).toContain("adr-0002");
  });

  it("adrCreate throws on missing title or decision", () => {
    expect(() => adrCreate({ title: "", decision: "x", consequences: "y" }, dir)).toThrow(/title/);
    expect(() => adrCreate({ title: "T", decision: "", consequences: "y" }, dir)).toThrow(/decision/);
  });

  it("adrList returns [] for non-existent dir", () => {
    expect(adrList(join(dir, "nonexistent"))).toEqual([]);
  });

  it("adrList returns entries sorted DESC by date then number", () => {
    adrCreate(
      { title: "Old A", decision: "x", consequences: "y", date: new Date("2026-04-01T00:00:00Z") },
      dir,
    );
    adrCreate(
      { title: "New 1", decision: "x", consequences: "y", date: new Date("2026-04-29T00:00:00Z") },
      dir,
    );
    adrCreate(
      { title: "New 2", decision: "x", consequences: "y", date: new Date("2026-04-29T00:00:00Z") },
      dir,
    );
    const list = adrList(dir);
    expect(list).toHaveLength(3);
    expect(list[0].title).toBe("New 2");
    expect(list[1].title).toBe("New 1");
    expect(list[2].title).toBe("Old A");
  });

  it("adrList parses front matter for status", () => {
    adrCreate(
      {
        title: "Accepted ADR",
        decision: "x",
        consequences: "y",
        status: "Accepted",
        date: new Date("2026-04-29T00:00:00Z"),
      },
      dir,
    );
    const [entry] = adrList(dir);
    expect(entry.status).toBe("Accepted");
  });

  it("adrList tolerates files missing front matter", () => {
    writeFileSync(join(dir, "2026-04-29-adr-0099-stub.md"), "no frontmatter here");
    const list = adrList(dir);
    expect(list).toHaveLength(1);
    expect(list[0].number).toBe(99);
    expect(list[0].status).toBe("Proposed");
  });
});
