/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-22.D6 — skill registry: directory loader tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSkillsFromDir } from "../core/skills/skill-loader.js";

function skill(name: string, body: string = "Body."): string {
  return `---
name: ${name}
description: ${name} description
category: know-me
phases: [IMPLEMENT]
---
${body}
`;
}

describe("skill-loader-dir (E22.D6)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "skill-loader-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads 3 skills from a flat directory", () => {
    writeFileSync(join(dir, "alpha.md"), skill("alpha"));
    writeFileSync(join(dir, "beta.md"), skill("beta"));
    writeFileSync(join(dir, "gamma.md"), skill("gamma"));
    const result = loadSkillsFromDir(dir);
    expect(result.loaded).toHaveLength(3);
    expect(result.loaded.map((s) => s.name).sort()).toEqual(["alpha", "beta", "gamma"]);
    expect(result.errors).toHaveLength(0);
  });

  it("recurses into subdirectories", () => {
    mkdirSync(join(dir, "domain"));
    writeFileSync(join(dir, "domain", "tdd.md"), skill("tdd"));
    writeFileSync(join(dir, "root-skill.md"), skill("root"));
    const result = loadSkillsFromDir(dir);
    expect(result.loaded).toHaveLength(2);
    expect(result.loaded.map((s) => s.name).sort()).toEqual(["root", "tdd"]);
  });

  it("ignores non-markdown files", () => {
    writeFileSync(join(dir, "skill.md"), skill("kept"));
    writeFileSync(join(dir, "README.txt"), "ignored");
    writeFileSync(join(dir, "data.json"), "{}");
    const result = loadSkillsFromDir(dir);
    expect(result.loaded).toHaveLength(1);
  });

  it("collects parse errors instead of throwing", () => {
    writeFileSync(join(dir, "ok.md"), skill("ok"));
    writeFileSync(join(dir, "broken.md"), "no frontmatter here");
    const result = loadSkillsFromDir(dir);
    expect(result.loaded).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toContain("broken.md");
  });

  it("returns errors gracefully when target dir does not exist", () => {
    const result = loadSkillsFromDir(join(dir, "nonexistent"));
    expect(result.loaded).toEqual([]);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty result on empty directory", () => {
    const result = loadSkillsFromDir(dir);
    expect(result.loaded).toEqual([]);
    expect(result.errors).toEqual([]);
  });
});
