/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { opencodeAliases, importOpenCodeSettings } from "../core/hooks/providers/opencode.js";
import { buildHooksHandler } from "../mcp/tools/hooks.js";

describe("providers/opencode.ts — aliases + importOpenCodeSettings", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-opencode-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("maps the 4 OpenCode hook events to mcp-graph channels", () => {
    expect(opencodeAliases["pre-tool"]).toBe("tool:pre-call");
    expect(opencodeAliases["post-tool"]).toBe("tool:post-call");
    expect(opencodeAliases["session.start"]).toBe("session:start");
    expect(opencodeAliases["session.end"]).toBe("session:end");
  });

  it("imports flat string hooks", () => {
    const path = join(tmp, "config.toml");
    writeFileSync(path, `[hooks]\npre-tool = "/usr/local/bin/pre"\npost-tool = "/usr/local/bin/post"\n`);
    const env = importOpenCodeSettings({ source: path, pluginDirs: [] });
    expect(env.imported).toHaveLength(2);
    expect(env.imported[0].agentSource).toBe("opencode");
    expect(env.provider).toBe("opencode");
  });

  it("flattens session.start / session.end nested keys", () => {
    const path = join(tmp, "config.toml");
    writeFileSync(path, `[hooks]\n[hooks.session]\nstart = "/bin/start"\nend = "/bin/end"\n`);
    const env = importOpenCodeSettings({ source: path, pluginDirs: [] });
    const channels = env.imported.map((h) => h.channel).sort();
    expect(channels).toEqual(["session:end", "session:start"]);
  });

  it("scans plugin dirs and reports paths (no execution)", () => {
    const pluginDir = join(tmp, "plugins");
    mkdirSync(pluginDir);
    writeFileSync(join(pluginDir, "alpha.ts"), "// plugin");
    writeFileSync(join(pluginDir, "beta.mjs"), "// plugin");
    writeFileSync(join(pluginDir, "ignore.md"), "not a plugin");

    const env = importOpenCodeSettings({ source: join(tmp, "no-config.toml"), pluginDirs: [pluginDir] });
    expect(env.pluginsDiscovered.length).toBe(2);
    expect(env.pluginsDiscovered.some((p) => p.endsWith("alpha.ts"))).toBe(true);
    expect(env.pluginsDiscovered.some((p) => p.endsWith("beta.mjs"))).toBe(true);
  });

  it("returns empty plugin list when dir doesn't exist", () => {
    const env = importOpenCodeSettings({ source: join(tmp, "no.toml"), pluginDirs: [join(tmp, "nope")] });
    expect(env.pluginsDiscovered).toEqual([]);
  });
});

describe("MCP tool — import_opencode action", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-opencode-action-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("round-trips a fixture and includes pluginsDiscovered", async () => {
    const path = join(tmp, "config.toml");
    writeFileSync(path, `[hooks]\npre-tool = "/bin/echo pre"\n`);
    const handler = buildHooksHandler();
    const result = await handler({ action: "import_opencode", source: path });
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("opencode");
    expect(body.imported).toBe(1);
    expect(Array.isArray(body.pluginsDiscovered)).toBe(true);
  });
});
