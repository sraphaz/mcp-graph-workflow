/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findRelevantDomainSkills,
  formatDomainSkillsBlock,
} from "../core/skills/domain-skill-retrieval.js";

function seed(rootDir: string, area: string, topic: string, triggers: string[], confidence = 0.8): void {
  const dir = join(rootDir, area);
  mkdirSync(dir, { recursive: true });
  const md = `---
domain: ${area}
topic: ${topic}
triggers: [${triggers.join(", ")}]
discovered_at: 2026-04-01T00:00:00.000Z
source_task: seed
confidence: ${confidence}
---

body
`;
  writeFileSync(join(dir, `${topic}.md`), md);
}

describe("findRelevantDomainSkills", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "domain-retrieval-"));
    seed(tmp, "sqlite-perf", "wal-mode", ["slow_writes", "lock_contention"]);
    seed(tmp, "sqlite-perf", "fts5-tuning", ["slow_search", "fts5_queries"]);
    seed(tmp, "rag", "chunk-overlap", ["retrieval_quality", "chunk_boundary"]);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns skills whose triggers match query tokens", () => {
    const matches = findRelevantDomainSkills(tmp, "fix slow writes during sqlite migration");
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]?.skill.topic).toBe("wal-mode");
    expect(matches[0]?.score).toBeGreaterThan(0);
  });

  it("returns empty array when no triggers match", () => {
    const matches = findRelevantDomainSkills(tmp, "kotlin coroutines garbage collection");
    expect(matches).toEqual([]);
  });

  it("matches by domain name as a fallback signal", () => {
    const matches = findRelevantDomainSkills(tmp, "improve our rag pipeline retrieval quality");
    const topics = matches.map((m) => m.skill.topic);
    expect(topics).toContain("chunk-overlap");
  });

  it("respects the limit parameter", () => {
    const matches = findRelevantDomainSkills(tmp, "slow_writes lock_contention slow_search", { limit: 1 });
    expect(matches).toHaveLength(1);
  });

  it("scores higher when more trigger tokens match", () => {
    const single = findRelevantDomainSkills(tmp, "slow_writes");
    const both = findRelevantDomainSkills(tmp, "slow_writes lock_contention");
    const wal = (m: ReturnType<typeof findRelevantDomainSkills>) =>
      m.find((x) => x.skill.topic === "wal-mode")?.score ?? 0;
    expect(wal(both)).toBeGreaterThan(wal(single));
  });
});

describe("formatDomainSkillsBlock", () => {
  it("returns empty string when no skills given", () => {
    expect(formatDomainSkillsBlock([])).toBe("");
  });

  it("includes 'Domain skills relevantes' header and topics", () => {
    const tmp = mkdtempSync(join(tmpdir(), "domain-fmt-"));
    seed(tmp, "sqlite-perf", "wal-mode", ["slow_writes"]);
    const matches = findRelevantDomainSkills(tmp, "slow_writes");
    rmSync(tmp, { recursive: true, force: true });

    const block = formatDomainSkillsBlock(matches);
    expect(block).toContain("Domain skills relevantes");
    expect(block).toContain("sqlite-perf/wal-mode");
  });
});
