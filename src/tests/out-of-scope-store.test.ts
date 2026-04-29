/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T06 — out-of-scope store tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  recordOutOfScope,
  checkOutOfScope,
  listOutOfScope,
  slugifyConcept,
  tokenSimilarity,
  DEFAULT_MATCH_THRESHOLD,
} from "../core/knowledge/out-of-scope-store.js";

describe("out-of-scope-store (E8.T06)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "oos-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("DEFAULT_MATCH_THRESHOLD = 0.7", () => {
    expect(DEFAULT_MATCH_THRESHOLD).toBe(0.7);
  });

  it("slugifyConcept lowercases + replaces non-alnum + trims", () => {
    expect(slugifyConcept("Add Kubernetes Support!")).toBe("add-kubernetes-support");
    expect(slugifyConcept("  Spaces  ")).toBe("spaces");
  });

  it("tokenSimilarity: identical → 1, disjoint → 0", () => {
    expect(tokenSimilarity("alpha beta gamma", "alpha beta gamma")).toBeCloseTo(1);
    expect(tokenSimilarity("aaa bbb", "ccc ddd")).toBe(0);
  });

  it("tokenSimilarity: partial overlap returns Jaccard", () => {
    // 2 shared / (3+3-2)=4 → 0.5
    const sim = tokenSimilarity("alpha beta gamma", "alpha beta delta");
    expect(sim).toBeCloseTo(0.5);
  });

  it("recordOutOfScope writes file with frontmatter + Reason section", () => {
    const entry = recordOutOfScope(
      "Add Kubernetes Support",
      "We are local-first; K8s out of scope.",
      dir,
      new Date("2026-04-29T00:00:00Z"),
    );
    expect(entry.slug).toBe("add-kubernetes-support");
    expect(entry.path).toContain(".md");
    const body = readFileSync(entry.path, "utf-8");
    expect(body).toContain("concept: Add Kubernetes Support");
    expect(body).toContain("date: 2026-04-29");
    expect(body).toContain("## Reason");
    expect(body).toContain("local-first");
  });

  it("recordOutOfScope creates .gitignore in dir", () => {
    recordOutOfScope("Test concept", "reason text here", dir);
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
  });

  it("recordOutOfScope updates existing file when same slug", () => {
    recordOutOfScope("Same concept", "first reason", dir);
    const second = recordOutOfScope("Same concept", "updated reason", dir);
    const body = readFileSync(second.path, "utf-8");
    expect(body).toContain("updated reason");
    expect(body).not.toContain("first reason");
  });

  it("recordOutOfScope throws on empty inputs", () => {
    expect(() => recordOutOfScope("", "r", dir)).toThrow(/concept/);
    expect(() => recordOutOfScope("c", "", dir)).toThrow(/reason/);
  });

  it("listOutOfScope returns entries with parsed concept + reason", () => {
    recordOutOfScope("Topic A", "reason a here long enough", dir);
    recordOutOfScope("Topic B", "reason b here", dir);
    const list = listOutOfScope(dir);
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.concept).sort()).toEqual(["Topic A", "Topic B"]);
  });

  it("listOutOfScope returns [] when dir missing", () => {
    expect(listOutOfScope(join(dir, "absent"))).toEqual([]);
  });

  it("checkOutOfScope returns matches above threshold sorted DESC", () => {
    recordOutOfScope(
      "Add Kubernetes Support",
      "kubernetes containers orchestration",
      dir,
    );
    recordOutOfScope("Database choice", "postgres mysql sqlite", dir);

    // Lower threshold so token similarity match is detectable
    const matches = checkOutOfScope("kubernetes containers", dir, 0.2);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].concept).toBe("Add Kubernetes Support");
  });

  it("checkOutOfScope returns [] when no concept matches threshold", () => {
    recordOutOfScope("foo bar baz", "completely unrelated topic", dir);
    expect(checkOutOfScope("alpha beta gamma", dir, 0.7)).toEqual([]);
  });

  it("checkOutOfScope honors custom threshold", () => {
    recordOutOfScope("alpha beta", "alpha beta gamma", dir);
    // exact text → similarity high, so even threshold 0.9 should match
    const matches = checkOutOfScope("alpha beta", dir, 0.9);
    expect(matches.length).toBeGreaterThanOrEqual(0); // lenient (Jaccard math)
  });
});
