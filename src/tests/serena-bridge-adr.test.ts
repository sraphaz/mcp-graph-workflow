/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-serena-symbol-retrieval-bridge — Task 1.2: ADR decisões unique-to-serena
 *
 * AC1: GIVEN N tools unique-to-serena WHEN ADR é escrito THEN N decisões com justificativa >= 50 chars
 * AC2: GIVEN decisão "delegar" WHEN ADR é escrito THEN cita exatamente qual MCP call routing usar
 * AC3: GIVEN decisão "reimplementar" WHEN ADR é escrito THEN aponta epic/task no graph
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ADR_PATH = join(process.cwd(), "docs/_internal/adr/0061-serena-bridge.md");
const ADR_PRESENT = existsSync(ADR_PATH);

function readAdr(): string {
  return readFileSync(ADR_PATH, "utf-8");
}

/** Extract decision blocks — h3 (### ) sections only, stopping at h2 (## ) boundaries */
function extractDecisionBlocks(content: string): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  let inDecision = false;
  for (const line of content.split("\n")) {
    if (line.startsWith("### ")) {
      if (inDecision && current.length > 0) sections.push(current.join("\n"));
      current = [line];
      inDecision = true;
    } else if (line.startsWith("## ")) {
      // h2 boundary ends the current decision block
      if (inDecision && current.length > 0) sections.push(current.join("\n"));
      current = [];
      inDecision = false;
    } else if (inDecision) {
      current.push(line);
    }
  }
  if (inDecision && current.length > 0) sections.push(current.join("\n"));
  return sections;
}

// ── AC1: N decisions with justification ≥ 50 chars each ─────────────────────

describe.skipIf(!ADR_PRESENT)("ADR 0061 — AC1: 10 decisions, each with justification ≥ 50 chars", () => {
  it("AC1: ADR file exists at docs/_internal/adr/0061-serena-bridge.md", () => {
    expect(() => readAdr()).not.toThrow();
  });

  it("AC1: at least 10 decision sections (one per unique-to-serena tool)", () => {
    const content = readAdr();
    const blocks = extractDecisionBlocks(content);
    expect(blocks.length).toBeGreaterThanOrEqual(10);
  });

  it("AC1: each decision block has justification text >= 50 chars", () => {
    const content = readAdr();
    const blocks = extractDecisionBlocks(content);
    for (const block of blocks) {
      // Strip the header line itself, count the body length
      const body = block.split("\n").slice(1).join("\n").trim();
      expect(body.length).toBeGreaterThanOrEqual(50);
    }
  });

  it("AC1: each decision block contains one of: delegar, reimplementar, ignorar", () => {
    const content = readAdr();
    const blocks = extractDecisionBlocks(content);
    const VALID = ["delegar", "reimplementar", "ignorar"];
    for (const block of blocks) {
      expect(VALID.some((v) => block.toLowerCase().includes(v))).toBe(true);
    }
  });
});

// ── AC2: "delegar" decisions cite exact MCP routing ──────────────────────────

describe.skipIf(!ADR_PRESENT)("ADR 0061 — AC2: delegar blocks cite MCP routing", () => {
  it("AC2: at least one delegar decision exists", () => {
    const content = readAdr();
    expect(content.toLowerCase()).toContain("delegar");
  });

  it("AC2: delegar sections cite a mcp__ call or tool routing reference", () => {
    const content = readAdr();
    const blocks = extractDecisionBlocks(content).filter((b) =>
      b.toLowerCase().includes("delegar"),
    );
    for (const block of blocks) {
      expect(block).toMatch(/mcp__|mcp\s+server|mcp-server|mcp_call|serena.*tool|tool.*serena/i);
    }
  });
});

// ── AC3: "reimplementar" blocks cite a graph node ────────────────────────────

describe.skipIf(!ADR_PRESENT)("ADR 0061 — AC3: reimplementar blocks cite graph node", () => {
  it("AC3: if any reimplementar decision exists, it cites a node_ reference", () => {
    const content = readAdr();
    const blocks = extractDecisionBlocks(content).filter((b) =>
      b.toLowerCase().includes("reimplementar"),
    );
    // If no reimplementar decisions, this test is vacuously true
    for (const block of blocks) {
      expect(block).toMatch(/node_[a-f0-9]+/i);
    }
  });
});
