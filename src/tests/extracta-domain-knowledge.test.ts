/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-domain-knowledge — covers improvements #6 (browser-skill
 * auto-proposer) and #9 (3 new domain knowledge files: ml, systems,
 * crypto).
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  proposeBrowserSkill,
  type BrowserSkillInput,
} from "../core/skills/browser-skill-proposer.js";
import { parseDomainSkillMarkdown, loadDomainSkills } from "../core/skills/domain-skill-loader.js";

describe("proposeBrowserSkill", () => {
  const baseInput: BrowserSkillInput = {
    taskId: "task_123",
    taskTitle: "Fill out signup form",
    startUrl: "https://www.example.com/signup",
    steps: [
      { action: "click", selector: "#email" },
      { action: "type", selector: "#email", notes: "user@example.com" },
      { action: "submit", selector: "form" },
    ],
    outcome: "success",
    discoveredAt: "2026-04-30T00:00:00.000Z",
  };

  it("strips www. and slugifies the site", () => {
    const r = proposeBrowserSkill(baseInput);
    expect(r.site).toBe("example.com");
    expect(r.suggestedPath).toBe("src/skills/domain/browser/example.com/fill-out-signup-form.md");
  });

  it("draft parses as a valid domain skill", () => {
    const r = proposeBrowserSkill(baseInput);
    const parsed = parseDomainSkillMarkdown(r.draft, r.suggestedPath);
    expect(parsed.ok).toBe(true);
    expect(parsed.skill?.domain).toBe("browser");
    expect(parsed.skill?.triggers.length).toBeGreaterThanOrEqual(1);
  });

  it("confidence drops for non-success outcomes", () => {
    const fail = proposeBrowserSkill({ ...baseInput, outcome: "failure" });
    expect(fail.confidence).toBeLessThan(proposeBrowserSkill(baseInput).confidence);
  });

  it("confidence increases with longer step sequences", () => {
    const longInput: BrowserSkillInput = {
      ...baseInput,
      steps: Array.from({ length: 8 }, (_, i) => ({ action: `step_${i}`, selector: `#x${i}` })),
    };
    expect(proposeBrowserSkill(longInput).confidence).toBeGreaterThan(
      proposeBrowserSkill({ ...baseInput, steps: [baseInput.steps[0]!] }).confidence,
    );
  });
});

describe("3 domain knowledge files (#9)", () => {
  const root = join(process.cwd(), "src", "skills", "domain");

  it.each([
    ["ml", "common-mistakes"],
    ["systems", "common-mistakes"],
    ["crypto", "common-mistakes"],
  ])("loads valid %s/%s skill", (area, topic) => {
    const path = join(root, area, `${topic}.md`);
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    const parsed = parseDomainSkillMarkdown(content, `${area}/${topic}.md`);
    expect(parsed.ok).toBe(true);
    expect(parsed.skill?.domain).toBe(area);
  });

  it("loadDomainSkills surfaces all 3 new areas", () => {
    const result = loadDomainSkills(root);
    expect(result.errors).toEqual([]);
    const domains = new Set(result.skills.map((s) => s.domain));
    expect(domains.has("ml")).toBe(true);
    expect(domains.has("systems")).toBe(true);
    expect(domains.has("crypto")).toBe(true);
  });
});
