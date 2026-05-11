/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 3.1 — .claude/rules/browser-harness.md structural test.
 *
 * AC1: file explicitly states "no LLM in mcp-graph; host drives via tool calls"
 * AC2: secrets section prohibits logging complete wsEndpoint
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RULES_FILE = join(process.cwd(), ".claude/rules/browser-harness.md");

function getRulesContent(): string {
  if (!existsSync(RULES_FILE)) return "";
  return readFileSync(RULES_FILE, "utf8");
}

describe("browser-harness rules file — AC1: no-LLM + host-drives statement", () => {
  it("file exists", () => {
    expect(existsSync(RULES_FILE)).toBe(true);
  });

  it("explicitly states no LLM in mcp-graph path", () => {
    const content = getRulesContent();
    expect(content).toMatch(/no\s+LLM/i);
  });

  it("explicitly states host drives via tool calls", () => {
    const content = getRulesContent();
    expect(content).toMatch(/host\s+drives/i);
  });

  it("mentions tool calls as the execution mechanism", () => {
    const content = getRulesContent();
    expect(content).toMatch(/tool\s+calls?/i);
  });
});

describe("browser-harness rules file — AC2: secrets section prohibits wsEndpoint logging", () => {
  it("has a secrets section", () => {
    const content = getRulesContent();
    expect(content).toMatch(/secrets?|log.*wsEndpoint|wsEndpoint.*log/i);
  });

  it("prohibits logging complete wsEndpoint", () => {
    const content = getRulesContent();
    // Must forbid logging the full URL (require masking)
    expect(content).toMatch(/never\s+log|mask|redact|<redacted>/i);
  });

  it("references ws:// masking pattern", () => {
    const content = getRulesContent();
    expect(content).toMatch(/ws:\/\//);
  });
});

describe("browser-harness rules file — description points coverage", () => {
  it("states connect to user Chrome, never spawn", () => {
    const content = getRulesContent();
    expect(content).toMatch(/never\s+spawn|do\s+not\s+spawn|connect.*Chrome|Chrome.*connect/i);
  });

  it("references §BROWSER_TEST or runId for helper change citations", () => {
    const content = getRulesContent();
    expect(content).toMatch(/§BROWSER_TEST|runId|run_id/i);
  });
});
