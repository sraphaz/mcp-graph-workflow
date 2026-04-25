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

/**
 * TDD tests for docs/_internal/migration/v11-maestro-surface.md (Task 5.2).
 *
 * Validates ACs:
 * - GIVEN cada tool removida WHEN doc consultado THEN tem entrada com
 *   (tool removida, replacement, exemplo de migracao)
 * - GIVEN doc WHEN linkado em CHANGELOG THEN aparece em release notes
 *
 * Test strategy: parse the markdown file, assert per-tool sections exist,
 * each section names the replacement, and contains a migration example
 * (fenced code block).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docPath = resolve(__dirname, "../../docs/_internal/migration/v11-maestro-surface.md");

/** Tools/modes scheduled for removal in PRD v11 Fase 5 (Task 5.3). */
const REMOVED_TOOLS = ["forecast", "davinci", "siebel", "translate"] as const;
const REMOVED_MODES = ["cfd", "code_sync", "economy_simulation"] as const;

/**
 * Extract the section under a heading whose text contains `needle`.
 * Returns the slice from that heading until the next heading at the same
 * or higher level (or EOF).
 */
function extractSection(markdown: string, needle: string): string | null {
  const lines = markdown.split("\n");
  let startIdx = -1;
  let startLevel = 0;
  const headingRe = /^(#{1,6})\s+(.*)$/;
  for (let i = 0; i < lines.length; i++) {
    const m = headingRe.exec(lines[i]);
    if (m && m[2].includes(needle)) {
      startIdx = i;
      startLevel = m[1].length;
      break;
    }
  }
  if (startIdx === -1) return null;
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = headingRe.exec(lines[i]);
    if (m && m[1].length <= startLevel) {
      endIdx = i;
      break;
    }
  }
  return lines.slice(startIdx, endIdx).join("\n");
}

describe("docs/_internal/migration/v11-maestro-surface.md", () => {
  let doc: string;

  beforeAll(() => {
    expect(existsSync(docPath), `Migration doc must exist at ${docPath}`).toBe(true);
    doc = readFileSync(docPath, "utf-8");
  });

  it("has a title heading", () => {
    expect(/^# /m.test(doc)).toBe(true);
  });

  it("references the PRD v11-maestro-surface-refactor", () => {
    expect(doc).toMatch(/v11.*maestro/i);
  });

  it("explains the advisory → warning → removed deprecation lifecycle", () => {
    expect(doc).toMatch(/advisory/i);
    expect(doc).toMatch(/warning/i);
    expect(doc).toMatch(/removed/i);
  });

  it("documents the MCP_GRAPH_LEGACY_TOOLS escape hatch", () => {
    expect(doc).toContain("MCP_GRAPH_LEGACY_TOOLS");
  });

  // AC1: each removed tool has its own section with replacement + migration example
  describe("AC1 — per-tool entries", () => {
    for (const tool of REMOVED_TOOLS) {
      it(`has a section for tool '${tool}' with replacement + migration example`, () => {
        const section = extractSection(doc, tool);
        expect(section, `section mentioning '${tool}' must exist`).not.toBeNull();

        // Migration example: fenced code block in the section
        const hasFence = /```/.test(section!);
        expect(hasFence, `section for '${tool}' must include a fenced code block as migration example`).toBe(true);

        // Replacement: section must mention either a concrete replacement tool
        // or explicitly state "no direct replacement" (allowed for specialized tools)
        const mentionsReplacement = /replacement|replaces?|→|->|→|substitut|migrate|use\s+`|use\s+the/i.test(section!);
        const noReplacement = /no\s+(direct\s+)?replacement|sem\s+(substituto|replacement)/i.test(section!);
        expect(mentionsReplacement || noReplacement,
          `section for '${tool}' must name a replacement or explicitly state none`).toBe(true);
      });
    }

    for (const mode of REMOVED_MODES) {
      it(`has a section for analyze mode '${mode}'`, () => {
        const section = extractSection(doc, mode);
        expect(section, `section mentioning analyze mode '${mode}' must exist`).not.toBeNull();
      });
    }

    it("has a section for the subset deprecation validate(action=task) → graph_validate_ui", () => {
      // From PRD Task 4.3: validate(action=task) is marked deprecated advisory
      // and the migration replacement is graph_validate_ui.
      expect(doc).toMatch(/validate.*(action.*task|action:\s*"task")/i);
      expect(doc).toMatch(/graph_validate_ui/);
    });
  });

  // AC2: doc is linked from CHANGELOG / release notes path
  describe("AC2 — release notes linkage", () => {
    it("includes a release notes / CHANGELOG section", () => {
      expect(doc).toMatch(/CHANGELOG|release notes|release-please/i);
    });

    it("explains how this doc enters release notes (via conventional commit referencing the path)", () => {
      // The doc must reference its own path so commit footers can link to it
      // and so release-please surfaces it in the generated CHANGELOG entry.
      expect(doc).toMatch(/docs\/migration\/v11-maestro-surface\.md/);
    });
  });
});
