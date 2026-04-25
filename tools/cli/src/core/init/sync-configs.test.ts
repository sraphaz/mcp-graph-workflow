/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkConfigs, syncConfigs } from "./sync-configs.js";

describe("syncConfigs", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-sync-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates .mcp.json and .claude/settings.local.json on a clean dir", () => {
    syncConfigs(tmp);

    expect(existsSync(join(tmp, ".mcp.json"))).toBe(true);
    expect(existsSync(join(tmp, ".claude", "settings.local.json"))).toBe(true);

    const mcp = JSON.parse(readFileSync(join(tmp, ".mcp.json"), "utf8"));
    expect(mcp.mcpServers["mcp-graph"]).toMatchObject({
      command: "npx",
      args: ["-y", "@mcp-graph-workflow/mcp-graph"],
    });

    const claude = JSON.parse(
      readFileSync(join(tmp, ".claude", "settings.local.json"), "utf8"),
    );
    expect(claude.permissions.allow).toContain("mcp__mcp-graph__*");
  });

  it("emits .vscode/mcp.json only when VS Code detected", () => {
    syncConfigs(tmp);
    expect(existsSync(join(tmp, ".vscode", "mcp.json"))).toBe(false);

    mkdirSync(join(tmp, ".vscode"), { recursive: true });
    syncConfigs(tmp, { force: true });
    expect(existsSync(join(tmp, ".vscode", "mcp.json"))).toBe(true);
  });

  it("emits .cursor/mcp.json only when Cursor detected", () => {
    mkdirSync(join(tmp, ".cursor"), { recursive: true });
    syncConfigs(tmp);
    expect(existsSync(join(tmp, ".cursor", "mcp.json"))).toBe(true);
  });

  it("is idempotent — re-running yields skipped-noop for everything", () => {
    syncConfigs(tmp);
    const result = syncConfigs(tmp);

    for (const change of result.changes) {
      expect(["skipped-noop", "skipped-existing"]).toContain(change.action);
    }
  });

  it("merges into an existing .mcp.json that has other servers", () => {
    writeFileSync(
      join(tmp, ".mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            "other-server": { command: "node", args: ["x.js"] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    syncConfigs(tmp);
    const merged = JSON.parse(readFileSync(join(tmp, ".mcp.json"), "utf8"));
    expect(merged.mcpServers["other-server"]).toBeDefined();
    expect(merged.mcpServers["mcp-graph"]).toBeDefined();
  });

  it("preserves a user-customized mcp-graph entry without --force", () => {
    writeFileSync(
      join(tmp, ".mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            "mcp-graph": {
              command: "/abs/path/mcp-graph",
              args: [],
              env: { CUSTOM: "1" },
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    syncConfigs(tmp);
    const after = JSON.parse(readFileSync(join(tmp, ".mcp.json"), "utf8"));
    expect(after.mcpServers["mcp-graph"].command).toBe("/abs/path/mcp-graph");
    expect(after.mcpServers["mcp-graph"].env.CUSTOM).toBe("1");
  });

  it("--force overwrites a user-customized entry", () => {
    writeFileSync(
      join(tmp, ".mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            "mcp-graph": { command: "old", args: [] },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    syncConfigs(tmp, { force: true });
    const after = JSON.parse(readFileSync(join(tmp, ".mcp.json"), "utf8"));
    expect(after.mcpServers["mcp-graph"].command).toBe("npx");
  });
});

describe("checkConfigs", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mg-check-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reports drift on a fresh dir without writing files", () => {
    const result = checkConfigs(tmp);
    expect(result.inSync).toBe(false);
    expect(result.drift.length).toBeGreaterThan(0);
    // never wrote
    expect(existsSync(join(tmp, ".mcp.json"))).toBe(false);
  });

  it("reports inSync after a successful sync", () => {
    syncConfigs(tmp);
    const result = checkConfigs(tmp);
    expect(result.inSync).toBe(true);
    expect(result.drift).toEqual([]);
  });
});
