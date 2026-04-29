/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T03 — skill scaffolder tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  scaffoldSkill,
  buildSkillTemplate,
  isValidSkillName,
  isValidCategory,
  SKILL_CATEGORIES,
} from "../core/skills/skill-scaffolder.js";

describe("skill-scaffolder (E8.T03)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "skill-scaffold-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("SKILL_CATEGORIES includes core lifecycle phases", () => {
    expect(SKILL_CATEGORIES).toContain("analyze");
    expect(SKILL_CATEGORIES).toContain("implement");
    expect(SKILL_CATEGORIES).toContain("review");
    expect(SKILL_CATEGORIES).toContain("any");
  });

  describe("isValidSkillName", () => {
    it("accepts kebab-case lowercase", () => {
      expect(isValidSkillName("tdd-red-green")).toBe(true);
      expect(isValidSkillName("plan")).toBe(true);
    });

    it("rejects uppercase / starts-with-digit / spaces", () => {
      expect(isValidSkillName("PLAN")).toBe(false);
      expect(isValidSkillName("1plan")).toBe(false);
      expect(isValidSkillName("two words")).toBe(false);
      expect(isValidSkillName("a")).toBe(false); // too short
    });
  });

  describe("isValidCategory", () => {
    it("accepts allowlist members", () => {
      expect(isValidCategory("plan")).toBe(true);
      expect(isValidCategory("any")).toBe(true);
    });

    it("rejects unknown values", () => {
      expect(isValidCategory("ops")).toBe(false);
      expect(isValidCategory("")).toBe(false);
    });
  });

  describe("buildSkillTemplate", () => {
    it("emits frontmatter + standard sections", () => {
      const md = buildSkillTemplate({
        name: "tdd",
        category: "implement",
        phases: ["IMPLEMENT", "VALIDATE"],
        description: "TDD discipline",
      });
      expect(md).toContain("name: tdd");
      expect(md).toContain("category: implement");
      expect(md).toContain("phases: [IMPLEMENT, VALIDATE]");
      expect(md).toContain("## When to use");
      expect(md).toContain("## Steps");
      expect(md).toContain("## Anti-patterns");
    });

    it("defaults phases to [IMPLEMENT] when omitted", () => {
      const md = buildSkillTemplate({ name: "x", category: "any" });
      expect(md).toContain("phases: [IMPLEMENT]");
    });
  });

  describe("scaffoldSkill", () => {
    it("creates file under dirRoot/category/name.md", () => {
      const r = scaffoldSkill(
        { name: "tdd", category: "implement" },
        { dirRoot: dir },
      );
      expect(r.alreadyExisted).toBe(false);
      expect(r.filename).toBe("tdd.md");
      expect(existsSync(r.path)).toBe(true);
      expect(readFileSync(r.path, "utf-8")).toContain("name: tdd");
    });

    it("returns alreadyExisted=true and skips when file present (no overwrite)", () => {
      scaffoldSkill({ name: "tdd", category: "implement" }, { dirRoot: dir });
      const second = scaffoldSkill(
        { name: "tdd", category: "implement", description: "second body" },
        { dirRoot: dir },
      );
      expect(second.alreadyExisted).toBe(true);
      const body = readFileSync(second.path, "utf-8");
      expect(body).not.toContain("second body");
    });

    it("overwrites when overwrite=true", () => {
      scaffoldSkill({ name: "tdd", category: "implement" }, { dirRoot: dir });
      const r = scaffoldSkill(
        { name: "tdd", category: "implement", description: "fresh body" },
        { dirRoot: dir, overwrite: true },
      );
      expect(r.alreadyExisted).toBe(true);
      expect(readFileSync(r.path, "utf-8")).toContain("fresh body");
    });

    it("throws on invalid name", () => {
      expect(() =>
        scaffoldSkill({ name: "BadName", category: "any" }, { dirRoot: dir }),
      ).toThrow(/invalid-name/);
    });

    it("throws on invalid category", () => {
      expect(() =>
        scaffoldSkill(
          { name: "ok", category: "weird" as never },
          { dirRoot: dir },
        ),
      ).toThrow(/invalid-category/);
    });

    it("creates intermediate category directory if missing", () => {
      const r = scaffoldSkill(
        { name: "fresh", category: "design" },
        { dirRoot: dir },
      );
      expect(existsSync(r.path)).toBe(true);
    });
  });
});
