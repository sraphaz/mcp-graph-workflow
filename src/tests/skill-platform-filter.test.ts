/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-sweep-1 — platform-aware skill loading. Domain skills can
 * declare a `platforms:` array; loader filters them against the
 * current `process.platform`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadDomainSkills,
  parseDomainSkillMarkdown,
} from "../core/skills/domain-skill-loader.js";

function makeMd(platforms: string[] | null): string {
  const lines = [
    "domain: x",
    "topic: y",
    "triggers: [t]",
    "discovered_at: 2026-04-01T00:00:00.000Z",
    "source_task: seed",
    "confidence: 0.5",
  ];
  if (platforms !== null) lines.push(`platforms: [${platforms.join(", ")}]`);
  return `---\n${lines.join("\n")}\n---\n\nbody\n`;
}

describe("parseDomainSkillMarkdown — platforms field", () => {
  it("parses a single platform", () => {
    const r = parseDomainSkillMarkdown(makeMd(["darwin"]), "x/y.md");
    expect(r.ok).toBe(true);
    expect(r.skill?.platforms).toEqual(["darwin"]);
  });

  it("parses multiple platforms", () => {
    const r = parseDomainSkillMarkdown(makeMd(["darwin", "linux"]), "x/y.md");
    expect(r.ok).toBe(true);
    expect(r.skill?.platforms).toEqual(["darwin", "linux"]);
  });

  it("accepts skill without platforms (= all OSes)", () => {
    const r = parseDomainSkillMarkdown(makeMd(null), "x/y.md");
    expect(r.ok).toBe(true);
    expect(r.skill?.platforms).toBeUndefined();
  });

  it("rejects an unknown platform value", () => {
    const r = parseDomainSkillMarkdown(makeMd(["bsd"]), "x/y.md");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/platform/i);
  });
});

describe("loadDomainSkills — platform filter", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "domain-skills-platform-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function writeSkill(topic: string, platforms: string[] | null): void {
    const dir = join(tmp, "area");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${topic}.md`), makeMd(platforms).replace("topic: y", `topic: ${topic}`));
  }

  it("filters out skills not matching current platform (darwin host)", () => {
    writeSkill("mac-only", ["darwin"]);
    writeSkill("linux-only", ["linux"]);
    writeSkill("any", null);

    const r = loadDomainSkills(tmp, { platform: "darwin" });
    const topics = r.skills.map((s) => s.topic).sort();
    expect(topics).toEqual(["any", "mac-only"]);
  });

  it("filters out skills not matching current platform (linux host)", () => {
    writeSkill("mac-only", ["darwin"]);
    writeSkill("linux-only", ["linux"]);
    writeSkill("any", null);

    const r = loadDomainSkills(tmp, { platform: "linux" });
    const topics = r.skills.map((s) => s.topic).sort();
    expect(topics).toEqual(["any", "linux-only"]);
  });

  it("includes skills declaring multiple platforms when one matches", () => {
    writeSkill("mac-and-linux", ["darwin", "linux"]);
    writeSkill("win-only", ["win32"]);

    const r = loadDomainSkills(tmp, { platform: "darwin" });
    const topics = r.skills.map((s) => s.topic).sort();
    expect(topics).toEqual(["mac-and-linux"]);
  });

  it("defaults to process.platform when no option provided", () => {
    writeSkill("any", null);
    const r = loadDomainSkills(tmp);
    expect(r.skills.map((s) => s.topic)).toEqual(["any"]);
  });
});
