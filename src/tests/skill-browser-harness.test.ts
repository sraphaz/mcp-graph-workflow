/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 3.2 — .claude/skills/browser-harness/SKILL.md structural test.
 *
 * AC1: covers Fast start, Tool call shape, What actually works, Gotchas
 * AC2: host can use primitives without reading source
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SKILL_FILE = join(process.cwd(), ".claude/skills/browser-harness/SKILL.md");

function getSkillContent(): string {
  if (!existsSync(SKILL_FILE)) return "";
  return readFileSync(SKILL_FILE, "utf8");
}

describe("browser-harness skill file — AC1: required sections", () => {
  it("file exists", () => {
    expect(existsSync(SKILL_FILE)).toBe(true);
  });

  it("has Fast start section", () => {
    expect(getSkillContent()).toMatch(/##\s*Fast\s*start/i);
  });

  it("has Tool call shape section", () => {
    expect(getSkillContent()).toMatch(/##\s*Tool\s*call\s*shape/i);
  });

  it("has What actually works section", () => {
    expect(getSkillContent()).toMatch(/##\s*What\s*actually\s*works/i);
  });

  it("has Gotchas section", () => {
    expect(getSkillContent()).toMatch(/##\s*Gotchas/i);
  });
});

describe("browser-harness skill file — AC2: self-contained primitives reference", () => {
  it("documents new_tab op", () => {
    expect(getSkillContent()).toMatch(/new_tab/);
  });

  it("documents screenshot op", () => {
    expect(getSkillContent()).toMatch(/screenshot/);
  });

  it("documents click op with selector", () => {
    expect(getSkillContent()).toMatch(/click/);
  });

  it("documents all 11 ops at least once", () => {
    const content = getSkillContent();
    const OPS = ["cdp", "js", "screenshot", "click", "type", "new_tab", "page_info", "wait_for_load", "helpers_add", "helpers_list", "recover"];
    const missing = OPS.filter((op) => !content.includes(op));
    expect(missing).toEqual([]);
  });

  it("shows JSON tool call shape", () => {
    expect(getSkillContent()).toMatch(/op.*:/);
  });

  it("mentions sessionId as required for most ops", () => {
    expect(getSkillContent()).toMatch(/sessionId/);
  });
});
