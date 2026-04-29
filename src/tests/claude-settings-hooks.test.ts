/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-10.T03 — Verify .claude/settings.json wires hooks correctly.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SETTINGS_PATH = join(process.cwd(), ".claude/settings.json");

interface HookEntry {
  type: string;
  command: string;
}
interface HookGroup {
  matcher: string;
  hooks: HookEntry[];
}
interface ClaudeSettings {
  hooks?: {
    PreToolUse?: HookGroup[];
    PostToolUse?: HookGroup[];
  };
}

// `.claude/settings.json` is gitignored (user-local). Tests skip when absent
// so a clean checkout doesn't fail; CI runs in repos that opt in.
const SETTINGS_PRESENT = existsSync(SETTINGS_PATH);

describe.skipIf(!SETTINGS_PRESENT)(".claude/settings.json hooks wiring (E10.T03)", () => {
  let settings: ClaudeSettings;

  it("file exists", () => {
    expect(existsSync(SETTINGS_PATH)).toBe(true);
  });

  it("parses as valid JSON", () => {
    expect(() => {
      settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    }).not.toThrow();
  });

  it("PreToolUse(Bash) registers block-dangerous-git.sh", () => {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    const preGroups = settings.hooks?.PreToolUse ?? [];
    const bashGroup = preGroups.find((g) => g.matcher === "Bash");
    expect(bashGroup).toBeDefined();
    const cmds = bashGroup?.hooks.map((h) => h.command) ?? [];
    expect(cmds.some((c) => c.includes("block-dangerous-git.sh"))).toBe(true);
  });

  it("PostToolUse(Bash) registers graph-wip-check.sh", () => {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    const postGroups = settings.hooks?.PostToolUse ?? [];
    const bashGroup = postGroups.find((g) => g.matcher === "Bash");
    expect(bashGroup).toBeDefined();
    const cmds = bashGroup?.hooks.map((h) => h.command) ?? [];
    expect(cmds.some((c) => c.includes("graph-wip-check.sh"))).toBe(true);
  });

  it("hook entries have type=command and non-empty command path", () => {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    const allHooks = [
      ...(settings.hooks?.PreToolUse ?? []),
      ...(settings.hooks?.PostToolUse ?? []),
    ].flatMap((g) => g.hooks);
    for (const h of allHooks) {
      expect(h.type).toBe("command");
      expect(h.command.length).toBeGreaterThan(0);
    }
  });

  it("referenced hook scripts exist on disk", () => {
    settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as ClaudeSettings;
    const allCommands = [
      ...(settings.hooks?.PreToolUse ?? []),
      ...(settings.hooks?.PostToolUse ?? []),
    ].flatMap((g) => g.hooks.map((h) => h.command));
    for (const cmd of allCommands) {
      const path = cmd.startsWith("/") ? cmd : join(process.cwd(), cmd);
      expect(existsSync(path), `missing hook script: ${cmd}`).toBe(true);
    }
  });
});
