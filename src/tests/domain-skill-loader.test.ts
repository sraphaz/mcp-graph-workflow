/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadDomainSkills,
  parseDomainSkillMarkdown,
} from "../core/skills/domain-skill-loader.js";

describe("parseDomainSkillMarkdown", () => {
  it("parses a valid domain skill markdown with full frontmatter", () => {
    const md = `---
domain: sqlite-perf
topic: wal-mode
triggers: [slow_writes, lock_contention]
discovered_at: 2026-04-01T00:00:00.000Z
source_task: node_seed
confidence: 0.85
---

# WAL mode

Body here.
`;
    const result = parseDomainSkillMarkdown(md, "sqlite-perf/wal-mode.md");
    expect(result.ok).toBe(true);
    expect(result.skill?.domain).toBe("sqlite-perf");
    expect(result.skill?.topic).toBe("wal-mode");
    expect(result.skill?.triggers).toEqual(["slow_writes", "lock_contention"]);
    expect(result.skill?.confidence).toBeCloseTo(0.85);
  });

  it("rejects a skill with empty triggers", () => {
    const md = `---
domain: x
topic: y
triggers: []
discovered_at: 2026-04-01T00:00:00.000Z
source_task: node_seed
confidence: 0.5
---

body`;
    const result = parseDomainSkillMarkdown(md, "x/y.md");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/triggers/i);
  });

  it("rejects a skill missing required frontmatter fields", () => {
    const md = `---
domain: x
topic: y
---

body`;
    const result = parseDomainSkillMarkdown(md, "x/y.md");
    expect(result.ok).toBe(false);
  });

  it("rejects markdown without frontmatter", () => {
    const result = parseDomainSkillMarkdown("# just a heading\n", "no/front.md");
    expect(result.ok).toBe(false);
  });
});

describe("loadDomainSkills", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "domain-skills-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeSkill(area: string, topic: string, frontmatter: Record<string, string | number | string[]>): void {
    const dir = join(tmp, area);
    mkdirSync(dir, { recursive: true });
    const fmLines = Object.entries(frontmatter).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: [${v.join(", ")}]`;
      return `${k}: ${v}`;
    });
    const md = `---\n${fmLines.join("\n")}\n---\n\nbody\n`;
    writeFileSync(join(dir, `${topic}.md`), md);
  }

  it("loads valid domain skills under <root>/<area>/<topic>.md", () => {
    writeSkill("sqlite-perf", "wal-mode", {
      domain: "sqlite-perf",
      topic: "wal-mode",
      triggers: ["slow_writes"],
      discovered_at: "2026-04-01T00:00:00.000Z",
      source_task: "seed",
      confidence: 0.8,
    });
    writeSkill("typescript", "zod-v4-migration", {
      domain: "typescript",
      topic: "zod-v4-migration",
      triggers: ["zod_upgrade"],
      discovered_at: "2026-04-01T00:00:00.000Z",
      source_task: "seed",
      confidence: 0.7,
    });

    const result = loadDomainSkills(tmp);
    expect(result.skills).toHaveLength(2);
    expect(result.skills.map((s) => s.domain).sort()).toEqual(["sqlite-perf", "typescript"]);
    expect(result.errors).toHaveLength(0);
  });

  it("collects errors for invalid skills without crashing", () => {
    writeSkill("good", "ok", {
      domain: "good",
      topic: "ok",
      triggers: ["t"],
      discovered_at: "2026-04-01T00:00:00.000Z",
      source_task: "seed",
      confidence: 0.5,
    });
    writeSkill("bad", "missing-triggers", {
      domain: "bad",
      topic: "missing-triggers",
      triggers: [],
      discovered_at: "2026-04-01T00:00:00.000Z",
      source_task: "seed",
      confidence: 0.5,
    });

    const result = loadDomainSkills(tmp);
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]?.domain).toBe("good");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.path).toMatch(/missing-triggers/);
  });

  it("returns empty result when root does not exist", () => {
    const result = loadDomainSkills(join(tmp, "does-not-exist"));
    expect(result.skills).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

describe("seed skills are present and parse", () => {
  it("loads the 5 seed skills from src/skills/domain/", () => {
    const result = loadDomainSkills(join(process.cwd(), "src", "skills", "domain"));
    expect(result.errors).toEqual([]);
    expect(result.skills.length).toBeGreaterThanOrEqual(5);
    const topics = result.skills.map((s) => `${s.domain}/${s.topic}`);
    expect(topics).toContain("sqlite-perf/wal-mode");
    expect(topics).toContain("sqlite-perf/fts5-tuning");
    expect(topics).toContain("typescript/zod-v4-migration");
    expect(topics).toContain("testing/vitest-isolation");
    expect(topics).toContain("rag/chunk-overlap-strategy");
  });
});
