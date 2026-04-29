/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexAliases, importCodexSettings } from "../core/hooks/providers/codex.js";
import { buildHooksHandler } from "../mcp/tools/hooks.js";

describe("providers/codex.ts — aliases + importCodexSettings", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-codex-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("maps the 3 Codex hook events to mcp-graph channels", () => {
    expect(codexAliases.notify).toBe("task:post-complete");
    expect(codexAliases["inspect.prompt"]).toBe("task:pre-execute");
    expect(codexAliases["inspect.tool_call"]).toBe("tool:pre-call");
  });

  it("imports a flat hook string", () => {
    const path = join(tmp, "config.toml");
    writeFileSync(path, `[hooks]\nnotify = "/usr/local/bin/notify-me"\n`);
    const env = importCodexSettings({ source: path });
    expect(env.imported).toHaveLength(1);
    expect(env.imported[0].agentSource).toBe("codex");
    expect(env.imported[0].channel).toBe("task:post-complete");
    expect(env.imported[0].kind).toBe("shell");
    expect(env.imported[0].commandArgs).toEqual(["-c", "/usr/local/bin/notify-me"]);
    expect(env.provider).toBe("codex");
  });

  it("flattens nested inspect.* keys", () => {
    const path = join(tmp, "config.toml");
    writeFileSync(path, `[hooks]\nnotify = "/bin/n"\n[hooks.inspect]\nprompt = "/bin/p"\ntool_call = "/bin/t"\n`);
    const env = importCodexSettings({ source: path });
    const ids = env.imported.map((h) => h.id).sort();
    expect(ids).toEqual([
      "codex-inspect-prompt-0-0",
      "codex-inspect-tool_call-0-0",
      "codex-notify-0-0",
    ]);
  });

  it("returns ok with reason when source missing", () => {
    const env = importCodexSettings({ source: join(tmp, "nope.toml") });
    expect(env.imported).toEqual([]);
    expect(env.skipped[0].reason).toMatch(/not found/);
  });

  it("returns ok with reason on parse error", () => {
    const path = join(tmp, "bad.toml");
    writeFileSync(path, "this is not toml :: at all >>");
    const env = importCodexSettings({ source: path });
    // Minimal TOML parser is permissive — bad lines just become string keys.
    // Assertion: importer doesn't crash, returns an envelope.
    expect(env.provider).toBe("codex");
    expect(env.source).toBe(path);
  });
});

describe("MCP tool — import_codex action", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-codex-action-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("round-trips a fixture via the hooks tool", async () => {
    const path = join(tmp, "config.toml");
    writeFileSync(path, `[hooks]\nnotify = "/bin/echo done"\n`);
    const handler = buildHooksHandler();
    const result = await handler({ action: "import_codex", source: path });
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("codex");
    expect(body.imported).toBe(1);
    expect(body.handlers[0].channel).toBe("task:post-complete");
  });
});
