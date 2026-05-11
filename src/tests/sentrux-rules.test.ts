/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC — Task 4.2: rules.toml complete architecture conventions
 *
 * AC1: GIVEN rules.toml WHEN parsed THEN contains all required rule IDs
 * AC2: GIVEN provider-sdk-confinement rule WHEN checked on adapter file THEN passes (allowed zone)
 * AC3: GIVEN core-no-mcp rule WHEN checked on violation THEN detected as forbidden
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const RULES_PATH = join(process.cwd(), ".sentrux/rules.toml");

function parseTomlRuleIds(content: string): string[] {
  const ids: string[] = [];
  const idPattern = /^\s*id\s*=\s*"([^"]+)"/gm;
  let match: RegExpExecArray | null;
  while ((match = idPattern.exec(content)) !== null) {
    ids.push(match[1]!);
  }
  return ids;
}

function getRulesContent(): string {
  return readFileSync(RULES_PATH, "utf-8");
}

// ── AC1: required rule IDs ────────────────────────────────────────────────────

describe("sentrux rules.toml — AC1: required rule coverage", () => {
  const REQUIRED_RULE_IDS = [
    "core-no-cli",
    "core-no-mcp",
    "core-no-api",
    "provider-sdk-confinement",
  ];

  it("AC1: all required rule IDs are present in rules.toml", () => {
    const content = getRulesContent();
    const ids = parseTomlRuleIds(content);
    for (const required of REQUIRED_RULE_IDS) {
      expect(ids, `missing rule: ${required}`).toContain(required);
    }
  });

  it("AC1: each rule has a non-empty description", () => {
    const content = getRulesContent();
    const descPattern = /description\s*=\s*"([^"]{5,})"/g;
    const descs: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = descPattern.exec(content)) !== null) {
      descs.push(match[1]!);
    }
    const ids = parseTomlRuleIds(content);
    expect(descs.length).toBeGreaterThanOrEqual(ids.length);
  });

  it("AC1: each rule has a severity of 'error' or 'warning'", () => {
    const content = getRulesContent();
    const sevPattern = /severity\s*=\s*"([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = sevPattern.exec(content)) !== null) {
      expect(["error", "warning"]).toContain(match[1]);
    }
  });
});

// ── AC2: provider-sdk-confinement in allowed zone ────────────────────────────

describe("sentrux rules.toml — AC2: provider-sdk-confinement allowed zone", () => {
  it("AC2: provider-sdk-confinement rule specifies allowed_zone for adapters/", () => {
    const content = getRulesContent();
    const ruleBlock = extractRuleBlock(content, "provider-sdk-confinement");
    expect(ruleBlock).toContain("allowed_zone");
    expect(ruleBlock).toMatch(/src\/core\/llm\/adapters/);
  });

  it("AC2: provider-sdk-confinement forbids openai import outside adapters", () => {
    const content = getRulesContent();
    const ruleBlock = extractRuleBlock(content, "provider-sdk-confinement");
    expect(ruleBlock).toMatch(/"openai"/);
  });
});

// ── AC3: core-no-mcp detects violation ───────────────────────────────────────

describe("sentrux rules.toml — AC3: core-no-mcp/core-no-api rules present", () => {
  it("AC3: core-no-mcp rule guards src/core/** and forbids src/mcp/**", () => {
    const content = getRulesContent();
    const ruleBlock = extractRuleBlock(content, "core-no-mcp");
    expect(ruleBlock).toMatch(/src\/core/);
    expect(ruleBlock).toMatch(/src\/mcp/);
  });

  it("AC3: core-no-api rule guards src/core/** and forbids src/api/**", () => {
    const content = getRulesContent();
    const ruleBlock = extractRuleBlock(content, "core-no-api");
    expect(ruleBlock).toMatch(/src\/core/);
    expect(ruleBlock).toMatch(/src\/api/);
  });

  it("AC3: core-no-cli rule guards src/core/** and forbids src/cli/**", () => {
    const content = getRulesContent();
    const ruleBlock = extractRuleBlock(content, "core-no-cli");
    expect(ruleBlock).toMatch(/src\/core/);
    expect(ruleBlock).toMatch(/src\/cli/);
  });
});

// ── helpers ───────────────────────────────────────────────────────────────────

function extractRuleBlock(toml: string, ruleId: string): string {
  const start = toml.indexOf(`id = "${ruleId}"`);
  if (start === -1) return "";
  const blockStart = toml.lastIndexOf("[[rules]]", start);
  const nextBlock = toml.indexOf("[[rules]]", start);
  const end = nextBlock === -1 ? toml.length : nextBlock;
  return toml.slice(blockStart, end);
}
