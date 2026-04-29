/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T02 — skill registry tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  listSkills,
  invokeSkill,
  invokeSkillByPath,
} from "../core/skills/skill-registry.js";

function skillFile(name: string, phases: string[] = ["IMPLEMENT"], body = "Body."): string {
  return `---
name: ${name}
description: ${name} skill
category: any
phases: [${phases.join(", ")}]
---
${body}
`;
}

describe("skill-registry (E8.T02)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "skill-registry-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("listSkills", () => {
    it("returns summaries for all skills, sorted alphabetically by name", () => {
      writeFileSync(join(dir, "beta.md"), skillFile("beta"));
      writeFileSync(join(dir, "alpha.md"), skillFile("alpha"));
      writeFileSync(join(dir, "gamma.md"), skillFile("gamma"));
      const r = listSkills(dir);
      expect(r.skills.map((s) => s.name)).toEqual(["alpha", "beta", "gamma"]);
      expect(r.skills[0]).toMatchObject({
        name: "alpha",
        description: "alpha skill",
        category: "any",
      });
    });

    it("prioritizes current-phase skills in the listing", () => {
      writeFileSync(join(dir, "off.md"), skillFile("off", ["VALIDATE"]));
      writeFileSync(join(dir, "match.md"), skillFile("match", ["IMPLEMENT"]));
      writeFileSync(join(dir, "zulu.md"), skillFile("zulu", ["IMPLEMENT"]));
      const r = listSkills(dir, "IMPLEMENT");
      expect(r.skills[0].name).toBe("match");
      expect(r.skills[1].name).toBe("zulu");
      expect(r.skills[2].name).toBe("off");
    });

    it("returns parse errors alongside summaries (graceful)", () => {
      writeFileSync(join(dir, "ok.md"), skillFile("ok"));
      writeFileSync(join(dir, "broken.md"), "no frontmatter");
      const r = listSkills(dir);
      expect(r.skills).toHaveLength(1);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].file).toContain("broken");
    });

    it("returns empty list (no errors) when dir is empty", () => {
      expect(listSkills(dir).skills).toEqual([]);
    });
  });

  describe("invokeSkill", () => {
    it("returns full skill (summary + body) by name", () => {
      writeFileSync(join(dir, "tdd.md"), skillFile("tdd", ["IMPLEMENT"], "Red, Green, Refactor."));
      const r = invokeSkill(dir, "tdd");
      expect(r?.name).toBe("tdd");
      expect(r?.body).toContain("Red, Green, Refactor");
    });

    it("returns undefined for unknown name", () => {
      writeFileSync(join(dir, "tdd.md"), skillFile("tdd"));
      expect(invokeSkill(dir, "nonexistent")).toBeUndefined();
    });

    it("recurses into subdirectories", () => {
      mkdirSync(join(dir, "domain"));
      writeFileSync(join(dir, "domain", "deep.md"), skillFile("deep"));
      const r = invokeSkill(dir, "deep");
      expect(r?.name).toBe("deep");
    });
  });

  describe("invokeSkillByPath", () => {
    it("returns skill body when path exists and parses", () => {
      const path = join(dir, "x.md");
      writeFileSync(path, skillFile("x", ["IMPLEMENT"], "X body content."));
      const r = invokeSkillByPath(path);
      expect(r?.body).toContain("X body content");
    });

    it("returns undefined when path missing or unparseable", () => {
      expect(invokeSkillByPath(join(dir, "missing.md"))).toBeUndefined();
      const broken = join(dir, "broken.md");
      writeFileSync(broken, "no frontmatter");
      expect(invokeSkillByPath(broken)).toBeUndefined();
    });
  });
});
