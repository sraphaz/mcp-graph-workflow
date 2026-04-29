/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadHookConfig } from "../core/hooks/config-loader.js";

describe("Hook config loader — 3-level merge precedence", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-graph-hooks-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns empty handlers when no config files exist", () => {
    const result = loadHookConfig({ paths: { user: join(tmp, "u.json"), project: join(tmp, "p.json"), local: join(tmp, "l.json") } });
    expect(result.handlers).toEqual([]);
    expect(result.sources.every((s) => !s.loaded)).toBe(true);
  });

  it("loads handlers from a single project config", () => {
    const path = join(tmp, "p.json");
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        hooks: {
          "tool:pre-call(toolName:Bash)": [
            { id: "block-rm-rf", channel: "tool:pre-call", kind: "shell", command: "/bin/true" },
          ],
        },
      }),
    );
    const result = loadHookConfig({ paths: { user: join(tmp, "u.json"), project: path, local: join(tmp, "l.json") } });
    expect(result.handlers).toHaveLength(1);
    expect(result.handlers[0].id).toBe("block-rm-rf");
    expect(result.sources.find((s) => s.path === path)?.loaded).toBe(true);
  });

  it("local config overrides project config on id collision", () => {
    const projectPath = join(tmp, "p.json");
    const localPath = join(tmp, "l.json");
    writeFileSync(projectPath, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "h1", channel: "tool:pre-call", kind: "shell", command: "/bin/project-version" }] },
    }));
    writeFileSync(localPath, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "h1", channel: "tool:pre-call", kind: "shell", command: "/bin/local-override" }] },
    }));
    const result = loadHookConfig({ paths: { user: join(tmp, "u.json"), project: projectPath, local: localPath } });
    expect(result.handlers).toHaveLength(1);
    expect(result.handlers[0].command).toBe("/bin/local-override");
  });

  it("user config is the lowest precedence (overridden by project + local)", () => {
    const userPath = join(tmp, "u.json");
    const projectPath = join(tmp, "p.json");
    writeFileSync(userPath, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "shared", channel: "tool:pre-call", kind: "shell", command: "/bin/user-default" }] },
    }));
    writeFileSync(projectPath, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "shared", channel: "tool:pre-call", kind: "shell", command: "/bin/project-wins" }] },
    }));
    const result = loadHookConfig({ paths: { user: userPath, project: projectPath, local: join(tmp, "l.json") } });
    expect(result.handlers).toHaveLength(1);
    expect(result.handlers[0].command).toBe("/bin/project-wins");
  });

  it("rejects malformed JSON without crashing the loader", () => {
    const path = join(tmp, "p.json");
    writeFileSync(path, "{ this is not valid json");
    const result = loadHookConfig({ paths: { user: join(tmp, "u.json"), project: path, local: join(tmp, "l.json") } });
    expect(result.handlers).toEqual([]);
    expect(result.sources.find((s) => s.path === path)?.loaded).toBe(false);
  });

  it("rejects schema-invalid handlers without crashing", () => {
    const path = join(tmp, "p.json");
    writeFileSync(path, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "bad", channel: "tool:pre-call", kind: "alien-kind" }] },
    }));
    const result = loadHookConfig({ paths: { user: join(tmp, "u.json"), project: path, local: join(tmp, "l.json") } });
    expect(result.handlers).toEqual([]);
    expect(result.sources.find((s) => s.path === path)?.loaded).toBe(false);
  });

  it("propagates the graphEventBridge map from any config file", () => {
    const path = join(tmp, "l.json");
    writeFileSync(path, JSON.stringify({
      version: 1,
      graphEventBridge: { "node:created": ["task:pre-execute"] },
    }));
    mkdirSync(join(tmp, ".mcp-graph"), { recursive: true });
    const result = loadHookConfig({ paths: { user: join(tmp, "u.json"), project: join(tmp, "p.json"), local: path } });
    expect(result.graphEventBridge["node:created"]).toEqual(["task:pre-execute"]);
  });
});
