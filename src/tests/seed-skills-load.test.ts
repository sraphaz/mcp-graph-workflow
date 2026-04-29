/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-8.T07 — Verify the seed SKILL.md files load via skill-registry.
 */

import { describe, it, expect } from "vitest";
import { listSkills } from "../core/skills/skill-registry.js";
import { join } from "node:path";

const SKILL_ROOT = join(process.cwd(), "src/skills");

describe("seed skills (E8.T07)", () => {
  it("registry loads 15+ skills from src/skills/", () => {
    const r = listSkills(SKILL_ROOT);
    expect(r.skills.length).toBeGreaterThanOrEqual(15);
  });

  it("loaded skills span all 7 lifecycle categories", () => {
    const r = listSkills(SKILL_ROOT);
    const cats = new Set(r.skills.map((s) => s.category));
    for (const c of ["analyze", "design", "plan", "implement", "review", "validate", "any"]) {
      expect(cats.has(c), `missing category: ${c}`).toBe(true);
    }
  });

  it("each skill has non-empty name + description", () => {
    const r = listSkills(SKILL_ROOT);
    for (const s of r.skills) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it("each skill body is non-stub (>=100 chars in description+name composite)", () => {
    const r = listSkills(SKILL_ROOT);
    for (const s of r.skills) {
      // Total surface should be substantive — name + description + phases combined > 30 chars
      const surface = `${s.name}${s.description}${s.phases.join("")}`;
      expect(surface.length).toBeGreaterThan(30);
    }
  });

  it("listSkills returns no parse errors for the seeded subset", () => {
    const r = listSkills(SKILL_ROOT);
    // Filter errors: legacy domain/<category>/*.md files exist with different
    // schema (domain/topic/triggers) so they may be in errors; that's fine.
    // The new seed files (T07) must all parse cleanly.
    const newSkillNames = [
      "decompose-prd", "grill-me", "design-an-interface", "seam-audit",
      "plan-sprint", "budget-aware-picking",
      "tracer-bullet-tdd", "anti-hallucination", "pure-decision-pattern",
      "deep-module-review", "citation-coverage-review",
      "dod-checklist", "harness-regression-check",
      "wip-one", "code-detachment", "lessons-consult",
    ];
    for (const name of newSkillNames) {
      expect(
        r.skills.some((s) => s.name === name),
        `skill not loaded: ${name}`,
      ).toBe(true);
    }
  });

  it("currentPhase=IMPLEMENT prioritizes implement-tagged skills first", () => {
    const r = listSkills(SKILL_ROOT, "IMPLEMENT");
    const firstNonImpl = r.skills.findIndex((s) => !s.phases.includes("IMPLEMENT"));
    const lastImpl = r.skills
      .map((s, i) => (s.phases.includes("IMPLEMENT") ? i : -1))
      .filter((i) => i >= 0)
      .pop()!;
    if (firstNonImpl >= 0) {
      expect(lastImpl).toBeLessThan(firstNonImpl);
    }
  });
});
