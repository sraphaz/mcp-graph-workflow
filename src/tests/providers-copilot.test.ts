/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copilotAliases, importCopilotSettings, installCopilotEventBridge } from "../core/hooks/providers/copilot.js";
import { buildHooksHandler } from "../mcp/tools/hooks.js";

describe("providers/copilot.ts — aliases + importCopilotSettings", () => {
  let tmp: string;
  let hooksDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-copilot-"));
    hooksDir = join(tmp, ".github", "hooks");
    mkdirSync(hooksDir, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("maps PreToolUse / PostToolUse / SessionStart / Stop / session.* events", () => {
    expect(copilotAliases.PreToolUse).toBe("tool:pre-call");
    expect(copilotAliases.PostToolUse).toBe("tool:post-call");
    expect(copilotAliases.SessionStart).toBe("session:start");
    expect(copilotAliases.Stop).toBe("task:post-complete");
    expect(copilotAliases["session.tool_call"]).toBe("tool:pre-call");
    expect(copilotAliases["session.error"]).toBe("task:error");
  });

  it("imports a single PreToolUse(Bash) hook from JSON", () => {
    writeFileSync(
      join(hooksDir, "block-rm-rf.json"),
      JSON.stringify({
        type: "block",
        event: "PreToolUse",
        matcher: "Bash",
        command: "/usr/local/bin/check-rm.sh",
        timeout: 3,
      }),
    );
    const env = importCopilotSettings({ source: hooksDir });
    expect(env.imported).toHaveLength(1);
    const h = env.imported[0];
    expect(h.channel).toBe("tool:pre-call");
    expect(h.matcher).toBe("tool:pre-call(toolName:Bash)");
    expect(h.kind).toBe("shell");
    expect(h.commandArgs).toEqual(["-c", "/usr/local/bin/check-rm.sh"]);
    expect(h.timeoutMs).toBe(3000);
    expect(h.agentSource).toBe("copilot");
  });

  it("imports an mjs extension as kind=mjs-module", () => {
    writeFileSync(
      join(hooksDir, "ext.json"),
      JSON.stringify({ type: "inspect", event: "PostToolUse", extension: "/path/to/extension.mjs" }),
    );
    const env = importCopilotSettings({ source: hooksDir });
    expect(env.imported[0].kind).toBe("mjs-module");
    expect(env.imported[0].command).toBe("/path/to/extension.mjs");
  });

  it("skips type=modify hooks", () => {
    writeFileSync(
      join(hooksDir, "modify.json"),
      JSON.stringify({ type: "modify", event: "PreToolUse", command: "/x" }),
    );
    const env = importCopilotSettings({ source: hooksDir });
    expect(env.imported).toHaveLength(0);
    expect(env.skipped[0].reason).toMatch(/modify hooks not supported/);
  });

  it("supports a wrapper file with hooks: [...]", () => {
    writeFileSync(
      join(hooksDir, "bundle.json"),
      JSON.stringify({
        hooks: [
          { type: "block", event: "PreToolUse", command: "/a" },
          { type: "inspect", event: "PostToolUse", command: "/b" },
        ],
      }),
    );
    const env = importCopilotSettings({ source: hooksDir });
    expect(env.imported).toHaveLength(2);
  });

  it("returns empty + skip reason when source dir doesn't exist", () => {
    const env = importCopilotSettings({ source: join(tmp, "nope") });
    expect(env.imported).toEqual([]);
    expect(env.skipped[0].reason).toMatch(/not found/);
  });

  it("installCopilotEventBridge returns a no-op disposer (M3.3 stub)", () => {
    const dispose = installCopilotEventBridge();
    expect(typeof dispose).toBe("function");
    expect(() => dispose()).not.toThrow();
  });
});

describe("MCP tool — kind=mjs-module shim", () => {
  let tmp: string;

  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "mcp-mjs-")); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("registers kind=mjs-module that runs node <file> via shell-handler", async () => {
    const markerFile = join(tmp, "marker");
    const ext = join(tmp, "ext.mjs");
    writeFileSync(ext, `import { writeFileSync } from "node:fs";\nlet stdin=""; process.stdin.on("data",c=>stdin+=c); process.stdin.on("end",()=>{writeFileSync(${JSON.stringify(markerFile)},stdin); process.exit(0);});`);

    const handler = buildHooksHandler();
    const reg = await handler({
      action: "register",
      channel: "task:post-complete",
      kind: "mjs-module",
      command: ext,
      handlerId: "mjs-test",
    });
    const body = JSON.parse(reg.content[0].text);
    expect(body.ok).toBe(true);
    expect(body.kind).toBe("mjs-module");

    const inv = await handler({
      action: "invoke",
      channel: "task:post-complete",
      payload: { nodeId: "abc" },
    });
    expect(JSON.parse(inv.content[0].text).ok).toBe(true);

    // Allow subprocess to finish writing the marker
    await new Promise((r) => setTimeout(r, 200));
    const { existsSync, readFileSync } = await import("node:fs");
    expect(existsSync(markerFile)).toBe(true);
    expect(readFileSync(markerFile, "utf-8")).toContain("task:post-complete");

    await handler({ action: "unregister", handlerId: "mjs-test" });
  });
});

describe("MCP tool — import_copilot action", () => {
  let tmp: string;
  let hooksDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-copilot-action-"));
    hooksDir = join(tmp, "hooks");
    mkdirSync(hooksDir, { recursive: true });
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it("round-trips a hooks dir via the MCP tool", async () => {
    writeFileSync(
      join(hooksDir, "h1.json"),
      JSON.stringify({ type: "block", event: "PreToolUse", command: "echo blocked" }),
    );
    const handler = buildHooksHandler();
    const result = await handler({ action: "import_copilot", source: hooksDir });
    const body = JSON.parse(result.content[0].text);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("copilot");
    expect(body.imported).toBe(1);
  });
});
