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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import {
  getIgnoreTemplate,
  ensureClaudeIgnore,
  ensureCopilotIgnore,
  updateClaudeIgnore,
  updateCopilotIgnore,
} from "../core/config/ignore-templates.js";

describe("ignore-templates", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `ignore-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Template content ──────────────────────────────

  it("should return non-empty ignore template", () => {
    const template = getIgnoreTemplate();

    expect(template.length).toBeGreaterThan(500);
    expect(template).toContain("node_modules/");
    expect(template).toContain("!CLAUDE.md");
  });

  it("should include critical ignore patterns", () => {
    const template = getIgnoreTemplate();

    expect(template).toContain("dist/");
    expect(template).toContain(".git/");
    expect(template).toContain("workflow-graph/");
    expect(template).toContain("*.db");
    expect(template).toContain(".env*");
    expect(template).toContain("coverage/");
  });

  it("should preserve CLAUDE.md and .claude/rules/", () => {
    const template = getIgnoreTemplate();

    expect(template).toContain("!CLAUDE.md");
    // Should not ignore .claude/rules/
    expect(template).not.toContain(".claude/rules/");
  });

  // ── .claudeignore and .copilotignore share same content ─

  it("should generate identical content for both ignore files", () => {
    ensureClaudeIgnore(tmpDir);
    ensureCopilotIgnore(tmpDir);

    const claudeContent = readFileSync(path.join(tmpDir, ".claudeignore"), "utf-8");
    const copilotContent = readFileSync(path.join(tmpDir, ".copilotignore"), "utf-8");

    expect(claudeContent).toBe(copilotContent);
  });

  // ── ensureClaudeIgnore ────────────────────────────

  it("should create .claudeignore if not exists", () => {
    const created = ensureClaudeIgnore(tmpDir);

    expect(created).toBe(true);
    expect(existsSync(path.join(tmpDir, ".claudeignore"))).toBe(true);
  });

  it("should NOT overwrite existing .claudeignore", () => {
    const filePath = path.join(tmpDir, ".claudeignore");
    writeFileSync(filePath, "# custom content\nnode_modules/\n", "utf-8");

    const created = ensureClaudeIgnore(tmpDir);

    expect(created).toBe(false);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("# custom content\nnode_modules/\n");
  });

  // ── ensureCopilotIgnore ───────────────────────────

  it("should create .copilotignore if not exists", () => {
    const created = ensureCopilotIgnore(tmpDir);

    expect(created).toBe(true);
    expect(existsSync(path.join(tmpDir, ".copilotignore"))).toBe(true);
  });

  it("should NOT overwrite existing .copilotignore", () => {
    const filePath = path.join(tmpDir, ".copilotignore");
    writeFileSync(filePath, "# my custom ignores\n", "utf-8");

    const created = ensureCopilotIgnore(tmpDir);

    expect(created).toBe(false);
    const content = readFileSync(filePath, "utf-8");
    expect(content).toBe("# my custom ignores\n");
  });

  // ── updateClaudeIgnore / updateCopilotIgnore ───────

  it("updateClaudeIgnore creates the file if missing", () => {
    const result = updateClaudeIgnore(tmpDir);

    expect(result.status).toBe("created");
    expect(readFileSync(path.join(tmpDir, ".claudeignore"), "utf-8")).toBe(getIgnoreTemplate());
  });

  it("updateClaudeIgnore overwrites stale content", () => {
    const filePath = path.join(tmpDir, ".claudeignore");
    writeFileSync(filePath, "# stale\nnode_modules/\n", "utf-8");

    const result = updateClaudeIgnore(tmpDir);

    expect(result.status).toBe("updated");
    expect(readFileSync(filePath, "utf-8")).toBe(getIgnoreTemplate());
  });

  it("updateClaudeIgnore reports up-to-date when file matches template", () => {
    writeFileSync(path.join(tmpDir, ".claudeignore"), getIgnoreTemplate(), "utf-8");

    const result = updateClaudeIgnore(tmpDir);

    expect(result.status).toBe("up-to-date");
  });

  it("updateClaudeIgnore in dryRun does not write but reports correct status", () => {
    const filePath = path.join(tmpDir, ".claudeignore");
    writeFileSync(filePath, "# stale\n", "utf-8");

    const result = updateClaudeIgnore(tmpDir, true);

    expect(result.status).toBe("updated");
    expect(readFileSync(filePath, "utf-8")).toBe("# stale\n");
  });

  it("updateCopilotIgnore behaves identically to updateClaudeIgnore", () => {
    const created = updateCopilotIgnore(tmpDir);
    expect(created.status).toBe("created");

    writeFileSync(path.join(tmpDir, ".copilotignore"), "# stale\n", "utf-8");
    const updated = updateCopilotIgnore(tmpDir);
    expect(updated.status).toBe("updated");

    const upToDate = updateCopilotIgnore(tmpDir);
    expect(upToDate.status).toBe("up-to-date");
  });

  // ── Anti-leak + new template invariants ────────────

  it("template does not leak third-party project names", () => {
    const template = getIgnoreTemplate();
    expect(template).not.toMatch(/karpathy|hermes-agent|understand-anything|gitnexus|serena|browser-use/i);
  });

  it("template covers vendored siblings via generic globs", () => {
    const template = getIgnoreTemplate();
    expect(template).toContain("*-skills/");
    expect(template).toContain("*-main/");
    expect(template).toContain("hermes-*");
    expect(template).toContain("understand-*");
    expect(template).toContain("vendor/");
  });

  it("template includes ai-shadow/ and .mcp-graph/ in MCP block", () => {
    const template = getIgnoreTemplate();
    expect(template).toContain("ai-shadow/");
    expect(template).toContain(".mcp-graph/");
  });

  it("template ignores tests (read on-demand via mcp-graph, not auto-loaded)", () => {
    const template = getIgnoreTemplate();
    expect(template).toMatch(/^src\/tests\/$/m);
    expect(template).toMatch(/^\*\.test\.ts$/m);
    expect(template).toMatch(/^\*\.spec\.ts$/m);
    expect(template).toMatch(/^__tests__\/$/m);
  });
});
