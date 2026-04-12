import { describe, it, expect } from "vitest";
import {
  BUILT_IN_SKILLS,
  getBuiltInSkills,
  getSkillsByPhase,
  getSkillByName,
  type BuiltInSkill,
} from "../core/skills/built-in-skills.js";

describe("BuiltInSkills Registry", () => {
  it("should have exactly 56 built-in skills", () => {
    expect(BUILT_IN_SKILLS).toHaveLength(56);
  });

  it("should have unique names across all skills", () => {
    const names = BUILT_IN_SKILLS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have non-empty instructions for every skill", () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.instructions.length).toBeGreaterThan(0);
    }
  });

  it("should have at least one phase for every skill", () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.phases.length).toBeGreaterThan(0);
    }
  });

  it("should only contain valid lifecycle phases", () => {
    const validPhases = new Set(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "DEPLOY", "LISTENING"]);
    for (const skill of BUILT_IN_SKILLS) {
      for (const phase of skill.phases) {
        expect(validPhases.has(phase)).toBe(true);
      }
    }
  });

  it("should have non-empty description and category for every skill", () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.category.length).toBeGreaterThan(0);
    }
  });

  it("should cover all 9 lifecycle phases", () => {
    const coveredPhases = new Set(BUILT_IN_SKILLS.flatMap((s) => s.phases));
    expect(coveredPhases.has("ANALYZE")).toBe(true);
    expect(coveredPhases.has("DESIGN")).toBe(true);
    expect(coveredPhases.has("PLAN")).toBe(true);
    expect(coveredPhases.has("IMPLEMENT")).toBe(true);
    expect(coveredPhases.has("VALIDATE")).toBe(true);
    expect(coveredPhases.has("REVIEW")).toBe(true);
    expect(coveredPhases.has("DEPLOY")).toBe(true);
    expect(coveredPhases.has("HANDOFF")).toBe(true);
    expect(coveredPhases.has("LISTENING")).toBe(true);
  });
});

describe("getBuiltInSkills", () => {
  it("should return all built-in skills", () => {
    const skills = getBuiltInSkills();
    expect(skills).toHaveLength(56);
  });
});

describe("getSkillsByPhase", () => {
  it("should return 6 skills for ANALYZE", () => {
    const skills = getSkillsByPhase("ANALYZE");
    expect(skills).toHaveLength(6);
    expect(skills.every((s: BuiltInSkill) => s.phases.includes("ANALYZE"))).toBe(true);
  });

  it("should return 28 skills for DESIGN", () => {
    const skills = getSkillsByPhase("DESIGN");
    expect(skills).toHaveLength(28);
  });

  it("should return 4 skills for PLAN", () => {
    const skills = getSkillsByPhase("PLAN");
    expect(skills).toHaveLength(4);
  });

  it("should return 21 skills for IMPLEMENT", () => {
    const skills = getSkillsByPhase("IMPLEMENT");
    expect(skills).toHaveLength(21);
  });

  it("should return 10 skills for VALIDATE", () => {
    const skills = getSkillsByPhase("VALIDATE");
    expect(skills).toHaveLength(10);
  });

  it("should return 27 skills for REVIEW", () => {
    const skills = getSkillsByPhase("REVIEW");
    expect(skills).toHaveLength(27);
  });

  it("should return 4 skills for DEPLOY", () => {
    const skills = getSkillsByPhase("DEPLOY");
    expect(skills).toHaveLength(4);
    expect(skills.every((s: BuiltInSkill) => s.phases.includes("DEPLOY"))).toBe(true);
  });

  it("should return 4 skills for HANDOFF", () => {
    const skills = getSkillsByPhase("HANDOFF");
    expect(skills).toHaveLength(4);
    expect(skills.every((s: BuiltInSkill) => s.phases.includes("HANDOFF"))).toBe(true);
  });

  it("should return 5 skills for LISTENING", () => {
    const skills = getSkillsByPhase("LISTENING");
    expect(skills).toHaveLength(5);
    expect(skills.every((s: BuiltInSkill) => s.phases.includes("LISTENING"))).toBe(true);
  });
});

describe("New skill categories", () => {
  it("should have 15 software-design skills", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "software-design");
    expect(skills).toHaveLength(15);
  });

  it("should have 1 DDD skill", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "ddd");
    expect(skills).toHaveLength(1);
  });

  it("should have 3 security skills", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "security");
    expect(skills).toHaveLength(3);
  });

  it("should have 1 frontend-design skill", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "frontend-design");
    expect(skills).toHaveLength(1);
  });

  it("should have 1 testing skill", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "testing");
    expect(skills).toHaveLength(1);
  });

  it("should have 1 research skill", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "research");
    expect(skills).toHaveLength(1);
  });

  it("should have 3 cost-reducer skills", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "cost-reducer");
    expect(skills).toHaveLength(3);
  });

  it("should have 3 deploy skills", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "deploy");
    expect(skills).toHaveLength(3);
  });

  it("should have 3 handoff skills", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "handoff");
    expect(skills).toHaveLength(3);
  });

  it("should have 3 listening skills", () => {
    const skills = BUILT_IN_SKILLS.filter((s) => s.category === "listening");
    expect(skills).toHaveLength(3);
  });

  it("should have self-healing-awareness skill in implement category", () => {
    const skill = getSkillByName("self-healing-awareness");
    expect(skill).toBeDefined();
    expect(skill!.phases).toContain("IMPLEMENT");
    expect(skill!.phases).toContain("VALIDATE");
  });
});

describe("getSkillByName", () => {
  it("should find a skill by name", () => {
    const skill = getSkillByName("code-reviewer");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("code-reviewer");
    expect(skill!.phases).toContain("REVIEW");
  });

  it("should return undefined for non-existent skill", () => {
    const skill = getSkillByName("non-existent-skill");
    expect(skill).toBeUndefined();
  });
});
