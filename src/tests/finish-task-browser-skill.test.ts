/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §extracta-wire-followups — finish_task → auto browser-skill hook.
 * Direct tests over the proposer hook, not the full finish_task path
 * (the latter has many gates orthogonal to this work).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  proposeBrowserSkillFromNode,
  writeBrowserSkillIfAbsent,
  proposeBrowserSkill,
  type BrowserSkillInput,
} from "../core/skills/browser-skill-proposer.js";

const validInput: BrowserSkillInput = {
  taskId: "task_xyz",
  taskTitle: "Submit a contact form",
  startUrl: "https://acme.test/contact",
  steps: [
    { action: "click", selector: "#name" },
    { action: "type", selector: "#name", notes: "Alice" },
    { action: "submit", selector: "form" },
  ],
  outcome: "success",
  discoveredAt: "2026-04-30T00:00:00.000Z",
};

describe("writeBrowserSkillIfAbsent", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "browser-skill-write-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("skips when MCP_GRAPH_AUTO_BROWSER_SKILL is not set", () => {
    const proposal = proposeBrowserSkill(validInput);
    const r = writeBrowserSkillIfAbsent(proposal, { rootDir: tmp, env: {} });
    expect(r.written).toBe(false);
    expect(r.reason).toBe("env_off");
    expect(existsSync(r.path)).toBe(false);
  });

  it("writes when env=1 and target absent", () => {
    const proposal = proposeBrowserSkill(validInput);
    const r = writeBrowserSkillIfAbsent(proposal, {
      rootDir: tmp,
      env: { MCP_GRAPH_AUTO_BROWSER_SKILL: "1" },
    });
    expect(r.written).toBe(true);
    expect(r.reason).toBe("ok");
    expect(existsSync(r.path)).toBe(true);
    expect(readFileSync(r.path, "utf-8")).toContain("domain: browser");
  });

  it("does not overwrite when target already exists", () => {
    const proposal = proposeBrowserSkill(validInput);
    const env = { MCP_GRAPH_AUTO_BROWSER_SKILL: "1" };
    writeBrowserSkillIfAbsent(proposal, { rootDir: tmp, env });
    const second = writeBrowserSkillIfAbsent(proposal, { rootDir: tmp, env });
    expect(second.written).toBe(false);
    expect(second.reason).toBe("already_exists");
  });

  it("skips low-confidence proposals (failure outcomes)", () => {
    const proposal = proposeBrowserSkill({ ...validInput, outcome: "failure" });
    const r = writeBrowserSkillIfAbsent(proposal, {
      rootDir: tmp,
      env: { MCP_GRAPH_AUTO_BROWSER_SKILL: "1" },
    });
    expect(r.written).toBe(false);
    expect(r.reason).toBe("low_confidence");
  });
});

describe("proposeBrowserSkillFromNode (finish_task hook)", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "browser-skill-node-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns no_metadata for nodes without browserSkillInput", () => {
    const r = proposeBrowserSkillFromNode({ metadata: { other: "thing" } }, { rootDir: tmp, env: { MCP_GRAPH_AUTO_BROWSER_SKILL: "1" } });
    expect(r.written).toBe(false);
    expect(r.reason).toBe("no_metadata");
  });

  it("writes a skill when node carries valid browserSkillInput", () => {
    const node = { metadata: { browserSkillInput: validInput } };
    const r = proposeBrowserSkillFromNode(node, {
      rootDir: tmp,
      env: { MCP_GRAPH_AUTO_BROWSER_SKILL: "1" },
    });
    expect(r.written).toBe(true);
    expect(r.path).toContain("/src/skills/domain/browser/acme.test/");
    expect(existsSync(r.path!)).toBe(true);
  });

  it("respects env gate even when metadata is valid", () => {
    const node = { metadata: { browserSkillInput: validInput } };
    const r = proposeBrowserSkillFromNode(node, { rootDir: tmp, env: {} });
    expect(r.written).toBe(false);
    expect(r.reason).toBe("env_off");
  });

  it("handles null/undefined node safely", () => {
    expect(proposeBrowserSkillFromNode(null).reason).toBe("no_metadata");
    expect(proposeBrowserSkillFromNode(undefined).reason).toBe("no_metadata");
    expect(proposeBrowserSkillFromNode({}).reason).toBe("no_metadata");
  });
});
