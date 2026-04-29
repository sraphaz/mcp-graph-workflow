/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §HOOKS-INTEGRATION 5.8 — Claude Code importer tests.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importClaudeCodeSettings } from "../core/hooks/claude-code-importer.js";

describe("claude-code-importer (HOOKS 5.8)", () => {
  let dir: string;
  let source: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ccimport-"));
    source = join(dir, "settings.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("imports a single PreToolUse(matcher=Bash) hook into shell handler", () => {
    writeFileSync(
      source,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo hi", timeout: 3 }],
            },
          ],
        },
      }),
    );
    const r = importClaudeCodeSettings({ source });
    expect(r.imported).toHaveLength(1);
    expect(r.skipped).toHaveLength(0);
    const h = r.imported[0];
    expect(h.channel).toBe("tool:pre-call");
    expect(h.kind).toBe("shell");
    expect(h.matcher).toBe("tool:pre-call(toolName:Bash)");
    expect(h.commandArgs).toEqual(["-c", "echo hi"]);
    expect(h.timeoutMs).toBe(3000);
    expect(h.agentSource).toBe("claude");
  });

  it("skips hooks whose Claude Code event has no mcp-graph analog (Notification, PreCompact)", () => {
    writeFileSync(
      source,
      JSON.stringify({
        hooks: {
          Notification: [{ hooks: [{ type: "command", command: "noop" }] }],
          PreCompact: [{ hooks: [{ type: "command", command: "noop" }] }],
          SessionStart: [{ hooks: [{ type: "command", command: "session-start.sh" }] }],
        },
      }),
    );
    const r = importClaudeCodeSettings({ source });
    expect(r.imported).toHaveLength(1);
    expect(r.imported[0].channel).toBe("session:start");
    const skippedEvents = r.skipped.map((s) => s.event);
    expect(skippedEvents).toContain("Notification");
    expect(skippedEvents).toContain("PreCompact");
  });

  it("skips entries whose hook.type is not 'command'", () => {
    writeFileSync(
      source,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { hooks: [{ type: "javascript", command: "throw 'no'" }] },
            { hooks: [{ type: "command", command: "ok" }] },
          ],
        },
      }),
    );
    const r = importClaudeCodeSettings({ source });
    expect(r.imported).toHaveLength(1);
    expect(r.skipped.length).toBeGreaterThanOrEqual(1);
  });

  it("returns a 'file unavailable' skip envelope when source does not exist", () => {
    const r = importClaudeCodeSettings({ source: join(dir, "missing.json") });
    expect(r.imported).toHaveLength(0);
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].event).toBe("*");
    expect(r.provider).toBe("claude");
  });

  it("uses default ~/.claude/settings.json path when no source is provided", () => {
    // We don't write to homedir; we just assert the source field is wired.
    const r = importClaudeCodeSettings();
    expect(r.source).toMatch(/\.claude\/settings\.json$/);
    expect(r.provider).toBe("claude");
  });

  it("default timeout=5000ms when Claude Code hook omits the timeout field", () => {
    writeFileSync(
      source,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [{ type: "command", command: "echo" }] },
          ],
        },
      }),
    );
    const r = importClaudeCodeSettings({ source });
    expect(r.imported[0].timeoutMs).toBe(5000);
  });
});
