/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readSettingsFile,
  parseToml,
  generateHandlerId,
  walkEventBlocks,
} from "../core/hooks/import-helpers.js";
import type { HookChannel } from "../core/hooks/hook-types.js";

describe("import-helpers — readSettingsFile", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-import-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("reads JSON", () => {
    const path = join(tmp, "x.json");
    writeFileSync(path, JSON.stringify({ a: 1, b: [2, 3] }));
    const r = readSettingsFile(path, "json");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ a: 1, b: [2, 3] });
  });

  it("reads YAML", () => {
    const path = join(tmp, "x.yml");
    writeFileSync(path, "a: 1\nb:\n  - 2\n  - 3\n");
    const r = readSettingsFile(path, "yaml");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ a: 1, b: [2, 3] });
  });

  it("reads minimal TOML", () => {
    const path = join(tmp, "x.toml");
    writeFileSync(path, `name = "test"\nport = 4127\nenabled = true\n[hooks]\non_notify = "/bin/true"\n`);
    const r = readSettingsFile(path, "toml");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const data = r.data as { name: string; port: number; enabled: boolean; hooks: { on_notify: string } };
      expect(data.name).toBe("test");
      expect(data.port).toBe(4127);
      expect(data.enabled).toBe(true);
      expect(data.hooks.on_notify).toBe("/bin/true");
    }
  });

  it("returns ok=false when file missing", () => {
    const r = readSettingsFile(join(tmp, "nope.json"), "json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not found/);
  });

  it("returns ok=false on parse error", () => {
    const path = join(tmp, "bad.json");
    writeFileSync(path, "{ broken");
    const r = readSettingsFile(path, "json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/parse error/);
  });
});

describe("import-helpers — parseToml subset", () => {
  it("handles dotted-table headers", () => {
    const out = parseToml(`[mcp_servers.foo]\ncommand = "bar"\n[mcp_servers.baz]\nargs = ["x", "y"]\n`);
    expect(out).toEqual({
      mcp_servers: { foo: { command: "bar" }, baz: { args: ["x", "y"] } },
    });
  });

  it("strips inline comments", () => {
    const out = parseToml(`port = 4127  # default\n`);
    expect(out.port).toBe(4127);
  });

  it("preserves # inside strings", () => {
    const out = parseToml(`note = "tag #1 important"\n`);
    expect(out.note).toBe("tag #1 important");
  });
});

describe("import-helpers — generateHandlerId", () => {
  it("produces deterministic, slug-safe ids", () => {
    expect(generateHandlerId("codex", "Inspect.ToolCall", 0, 0)).toBe("codex-inspect-toolcall-0-0");
    expect(generateHandlerId("claude", "PreToolUse", 1, 2)).toBe("claude-pretooluse-1-2");
  });
});

describe("import-helpers — walkEventBlocks", () => {
  const aliases: Record<string, HookChannel | null> = {
    notify: "task:post-complete",
    SkipMe: null,
  };

  it("imports mapped events and skips null-aliased ones", () => {
    const env = walkEventBlocks(
      {
        provider: "codex",
        aliases,
        blocksByEvent: {
          notify: [{ hooks: [{ command: "echo done" }] }],
          SkipMe: [{ hooks: [{ command: "echo skip" }] }],
        },
        blockHooks: (block: { hooks: { command: string }[] }) => block.hooks,
        toHandler: (event, channel, _matcher, hook, blockIdx, hookIdx) => ({
          id: generateHandlerId("codex", event, blockIdx, hookIdx),
          channel,
          kind: "shell" as const,
          command: "/bin/sh",
          commandArgs: ["-c", hook.command],
          agentSource: "codex" as const,
        }),
      },
      "/dev/null",
    );

    expect(env.provider).toBe("codex");
    expect(env.imported).toHaveLength(1);
    expect(env.imported[0].id).toBe("codex-notify-0-0");
    expect(env.imported[0].agentSource).toBe("codex");
    expect(env.skipped).toEqual([{ event: "SkipMe", reason: "no mcp-graph analog" }]);
  });

  it("skip reason from toHandler propagates", () => {
    const env = walkEventBlocks(
      {
        provider: "codex",
        aliases,
        blocksByEvent: { notify: [{ hooks: [{ bad: true }] }] },
        blockHooks: (block: { hooks: unknown[] }) => block.hooks,
        toHandler: () => ({ skip: "bad shape" }),
      },
      "/dev/null",
    );
    expect(env.imported).toHaveLength(0);
    expect(env.skipped[0].reason).toBe("block 0.0: bad shape");
  });
});
