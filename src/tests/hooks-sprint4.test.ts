/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChannel, CLAUDE_CODE_ALIASES } from "../core/hooks/channel-aliases.js";
import { importClaudeCodeSettings } from "../core/hooks/claude-code-importer.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { installGraphEventBridge } from "../core/hooks/graph-event-bridge.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

describe("Channel aliases — Claude Code ↔ mcp-graph", () => {
  it("maps every supported Claude Code event to a mcp-graph channel", () => {
    expect(resolveChannel("PreToolUse")).toBe("tool:pre-call");
    expect(resolveChannel("PostToolUse")).toBe("tool:post-call");
    expect(resolveChannel("SessionStart")).toBe("session:start");
    expect(resolveChannel("SessionEnd")).toBe("session:end");
    expect(resolveChannel("Stop")).toBe("task:post-complete");
    expect(resolveChannel("SubagentStop")).toBe("agent:post-spawn");
    expect(resolveChannel("UserPromptSubmit")).toBe("task:pre-execute");
  });

  it("returns null for events with no analog (Notification, PreCompact)", () => {
    expect(resolveChannel("Notification")).toBeNull();
    expect(resolveChannel("PreCompact")).toBeNull();
  });

  it("passes native mcp-graph channels through unchanged", () => {
    expect(resolveChannel("task:pre-execute")).toBe("task:pre-execute");
    expect(resolveChannel("memory:pre-store")).toBe("memory:pre-store");
  });

  it("returns null for unknown strings", () => {
    expect(resolveChannel("definitely-not-a-channel")).toBeNull();
  });

  it("alias table covers all 9 Claude Code events", () => {
    const keys = Object.keys(CLAUDE_CODE_ALIASES);
    expect(keys).toEqual([
      "PreToolUse",
      "PostToolUse",
      "SessionStart",
      "SessionEnd",
      "Stop",
      "SubagentStop",
      "UserPromptSubmit",
      "Notification",
      "PreCompact",
    ]);
  });
});

describe("Claude Code importer", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-graph-import-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("imports a PreToolUse(Bash) shell command as kind=shell handler", () => {
    const path = join(tmp, "settings.json");
    writeFileSync(path, JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo blocked-by-policy && exit 2" }],
          },
        ],
      },
    }));
    const result = importClaudeCodeSettings({ source: path });
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].channel).toBe("tool:pre-call");
    expect(result.imported[0].kind).toBe("shell");
    expect(result.imported[0].command).toBe("/bin/sh");
    expect(result.imported[0].commandArgs).toEqual(["-c", "echo blocked-by-policy && exit 2"]);
    expect(result.imported[0].matcher).toBe("tool:pre-call(toolName:Bash)");
  });

  it("skips Notification and PreCompact (no analog)", () => {
    const path = join(tmp, "settings.json");
    writeFileSync(path, JSON.stringify({
      hooks: {
        Notification: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreCompact: [{ hooks: [{ type: "command", command: "echo bye" }] }],
        SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
      },
    }));
    const result = importClaudeCodeSettings({ source: path });
    expect(result.imported).toHaveLength(1);
    expect(result.imported[0].channel).toBe("session:start");
    expect(result.skipped.map((s) => s.event).sort()).toEqual(["Notification", "PreCompact"]);
  });

  it("returns empty result when source file does not exist", () => {
    const result = importClaudeCodeSettings({ source: join(tmp, "nope.json") });
    expect(result.imported).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/not found/);
  });

  it("returns empty result with parse error when JSON is malformed", () => {
    const path = join(tmp, "bad.json");
    writeFileSync(path, "{ not valid json");
    const result = importClaudeCodeSettings({ source: path });
    expect(result.imported).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/parse error/);
  });

  it("handles multiple hooks within the same matcher block", () => {
    const path = join(tmp, "settings.json");
    writeFileSync(path, JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit",
            hooks: [
              { type: "command", command: "echo first" },
              { type: "command", command: "echo second" },
            ],
          },
        ],
      },
    }));
    const result = importClaudeCodeSettings({ source: path });
    expect(result.imported).toHaveLength(2);
    expect(result.imported[0].id).not.toBe(result.imported[1].id);
  });
});

describe("GraphEventBus → HookBus bridge", () => {
  it("re-emits GraphEvents only for explicitly mapped channels", async () => {
    const graphBus = new GraphEventBus();
    const hookBus = new HookBus(graphBus);
    const captured: HookEvent[] = [];
    hookBus.on("task:pre-execute", async (e) => { captured.push(e); });
    hookBus.on("memory:pre-store", async (e) => { captured.push(e); });

    const dispose = installGraphEventBridge(graphBus, hookBus, {
      mapping: {
        "node:created": ["task:pre-execute"],
        // node:updated intentionally NOT mapped — must NOT emit
      },
    });

    graphBus.emitTyped("node:created", { id: "n1" });
    graphBus.emitTyped("node:updated", { id: "n1" });
    await new Promise((r) => setImmediate(r));

    expect(captured).toHaveLength(1);
    expect(captured[0].channel).toBe("task:pre-execute");
    expect(captured[0].payload._fromBridge).toBe(true);
    expect((captured[0].payload.graphPayload as { id: string }).id).toBe("n1");

    dispose();
  });

  it("dispose() removes all bridge listeners", async () => {
    const graphBus = new GraphEventBus();
    const hookBus = new HookBus(graphBus);
    const captured: HookEvent[] = [];
    hookBus.on("task:pre-execute", async (e) => { captured.push(e); });

    const dispose = installGraphEventBridge(graphBus, hookBus, {
      mapping: { "node:created": ["task:pre-execute"] },
    });
    dispose();

    graphBus.emitTyped("node:created", { id: "n2" });
    await new Promise((r) => setImmediate(r));

    expect(captured).toHaveLength(0);
  });

  it("empty channel list per mapping entry is a no-op (default-disabled)", async () => {
    const graphBus = new GraphEventBus();
    const hookBus = new HookBus(graphBus);
    const captured: HookEvent[] = [];
    hookBus.on("task:pre-execute", async (e) => { captured.push(e); });

    installGraphEventBridge(graphBus, hookBus, { mapping: { "node:created": [] } });
    graphBus.emitTyped("node:created", { id: "n3" });
    await new Promise((r) => setImmediate(r));

    expect(captured).toHaveLength(0);
  });
});

// Mute unused-warning helpers
void mkdirSync;
