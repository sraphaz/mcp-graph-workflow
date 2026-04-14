#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";

const distUcrDir = "dist/core/translation/ucr";
mkdirSync(distUcrDir, { recursive: true });
cpSync("src/core/translation/ucr/construct-seed-data.json", join(distUcrDir, "construct-seed-data.json"));

const codexSkillsDir = "dist/assets/codex-skills";
rmSync(codexSkillsDir, { recursive: true, force: true });
mkdirSync(codexSkillsDir, { recursive: true });

if (existsSync("skills-graph")) {
  for (const file of readdirSync("skills-graph")) {
    if (file.endsWith(".md")) {
      cpSync(join("skills-graph", file), join(codexSkillsDir, file));
    }
  }
}

const uiSkillPath = ".claude/skills/ui-ux-pro-max/SKILL.md";
if (existsSync(uiSkillPath)) {
  cpSync(uiSkillPath, join(codexSkillsDir, `${basename("ui-ux-pro-max")}.md`));
}
