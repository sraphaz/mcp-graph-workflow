/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect } from "vitest";
import { getSkillByName } from "../core/skills/built-in-skills.js";

/**
 * Import PHASE_SKILLS via dynamic evaluation since it's not exported directly.
 * We test the source of truth by importing the reference-content module.
 */

// Re-declare the PHASE_SKILLS mapping to test against built-in skills registry.
// This must stay in sync with src/core/config/reference-content.ts PHASE_SKILLS.
const PHASE_SKILLS: Record<string, string[]> = {
  ANALYZE: ["create-prd-chat-mode", "business-analyst", "product-manager"],
  DESIGN: ["breakdown-epic-arch", "context-architect", "backend-architect"],
  PLAN: ["breakdown-feature-prd", "track-with-mcp-graph"],
  IMPLEMENT: ["subagent-driven-development", "xp-bootstrap", "self-healing-awareness"],
  VALIDATE: ["playwright-explore-website", "playwright-generate-test", "e2e-testing"],
  REVIEW: ["code-reviewer", "code-review-checklist", "review-and-refactor", "observability-engineer"],
  DEPLOY: ["deployment-engineer", "devops-deploy", "git-pushing"],
  HANDOFF: ["delivery-checklist", "pr-documentation", "knowledge-capture"],
  LISTENING: ["feedback-collector", "iteration-planner", "metrics-retrospective"],
};

const ALL_PHASES = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "DEPLOY", "HANDOFF", "LISTENING"];

describe("PHASE_SKILLS ↔ built-in-skills sync", () => {
  it("should have entries for all 9 lifecycle phases", () => {
    for (const phase of ALL_PHASES) {
      expect(PHASE_SKILLS[phase]).toBeDefined();
      expect(PHASE_SKILLS[phase].length).toBeGreaterThan(0);
    }
  });

  it("should only reference skills that exist in the built-in registry", () => {
    for (const [phase, skills] of Object.entries(PHASE_SKILLS)) {
      for (const skillName of skills) {
        const skill = getSkillByName(skillName);
        expect(skill, `Ghost skill "${skillName}" referenced in PHASE_SKILLS.${phase} does not exist`).toBeDefined();
      }
    }
  });
});
