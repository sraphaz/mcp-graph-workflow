/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  type CommandDefinition,
  clearRegistryForTests,
  findCommandByShell,
  findCommandBySlash,
  fuzzyMatchCommands,
  listCommands,
  registerCommand,
} from "./registry.js";

const noopHandler = async () => ({ exitCode: 0 });

const sampleCommand: CommandDefinition = {
  id: "init",
  name: "init",
  description: "Initialize a new mcp-graph project",
  usage: "init [--non-interactive]",
  slashAliases: ["init"],
  shellAliases: ["init"],
  category: "lifecycle",
  handler: noopHandler,
};

afterEach(() => {
  clearRegistryForTests();
});

describe("registry", () => {
  it("registers a command and lists it back", () => {
    registerCommand(sampleCommand);
    expect(listCommands()).toHaveLength(1);
    expect(listCommands()[0].id).toBe("init");
  });

  it("rejects duplicate id", () => {
    registerCommand(sampleCommand);
    expect(() => registerCommand(sampleCommand)).toThrow(/already registered/);
  });

  it("findCommandBySlash matches the slash alias", () => {
    registerCommand(sampleCommand);
    expect(findCommandBySlash("/init")?.id).toBe("init");
    expect(findCommandBySlash("init")?.id).toBe("init");
    expect(findCommandBySlash("/init --type=node")?.id).toBe("init");
  });

  it("findCommandByShell matches the shell alias", () => {
    registerCommand(sampleCommand);
    expect(findCommandByShell("init")?.id).toBe("init");
  });

  it("returns undefined for unknown commands", () => {
    expect(findCommandBySlash("/ghost")).toBeUndefined();
    expect(findCommandByShell("ghost")).toBeUndefined();
  });
});

describe("fuzzyMatchCommands", () => {
  it("ranks exact match first", () => {
    registerCommand(sampleCommand);
    registerCommand({
      ...sampleCommand,
      id: "info",
      name: "info",
      slashAliases: ["info"],
      shellAliases: ["info"],
    });
    const out = fuzzyMatchCommands("init");
    expect(out[0].id).toBe("init");
  });

  it("ranks prefix matches above subsequence", () => {
    registerCommand(sampleCommand);
    registerCommand({
      ...sampleCommand,
      id: "list",
      name: "list",
      slashAliases: ["list"],
      shellAliases: ["list"],
      description: "list initial entries",
    });
    const out = fuzzyMatchCommands("ini");
    expect(out[0].id).toBe("init");
  });

  it("returns subsequence matches", () => {
    registerCommand({
      ...sampleCommand,
      id: "harness-call",
      name: "harness call",
      slashAliases: ["harness", "harness-call"],
      shellAliases: ["harness"],
    });
    const out = fuzzyMatchCommands("hcl");
    expect(out.some((c) => c.id === "harness-call")).toBe(true);
  });

  it("returns empty list for no matches", () => {
    registerCommand(sampleCommand);
    expect(fuzzyMatchCommands("zzzzz")).toHaveLength(0);
  });

  it("matches a single-character substitution typo (Sprint 7 #7.9 — `stsrt` → `start`)", () => {
    registerCommand({
      ...sampleCommand,
      id: "start",
      name: "start",
      slashAliases: ["start"],
      shellAliases: ["start"],
    });
    const out = fuzzyMatchCommands("stsrt");
    // "stsrt" is NOT a subsequence of "start" (mid-letter substitution),
    // so the pre-7.9 implementation would miss it. Damerau–Levenshtein
    // tier should catch it within typo budget = 2 (q.length=5).
    expect(out.some((c) => c.id === "start")).toBe(true);
  });

  it("matches a single-character deletion typo (`lst` → `list`)", () => {
    registerCommand({
      ...sampleCommand,
      id: "list",
      name: "list",
      slashAliases: ["list"],
      shellAliases: ["list"],
    });
    const out = fuzzyMatchCommands("lst");
    expect(out.some((c) => c.id === "list")).toBe(true);
  });

  it("matches a transposition typo (`iint` → `init`)", () => {
    // Damerau distinguishes adjacent transposition from 2× substitutions.
    // `iint` is `init` with positions 1↔2 swapped — 1 edit under Damerau.
    registerCommand(sampleCommand);
    const out = fuzzyMatchCommands("iint");
    expect(out.some((c) => c.id === "init")).toBe(true);
  });

  it("ranks exact match above typo match (Sprint 7 #7.9)", () => {
    registerCommand({
      ...sampleCommand,
      id: "init",
      name: "init",
      slashAliases: ["init"],
      shellAliases: ["init"],
    });
    registerCommand({
      ...sampleCommand,
      id: "lint",
      name: "lint",
      slashAliases: ["lint"],
      shellAliases: ["lint"],
    });
    const out = fuzzyMatchCommands("init");
    // Exact "init" must outrank typo-1 "lint" (one substitution).
    expect(out[0]?.id).toBe("init");
  });

  it("rejects matches beyond the typo budget on a short query", () => {
    registerCommand(sampleCommand);
    // q.length=4 → budget=1. "init" → "xyzz" needs 4 substitutions; reject.
    const out = fuzzyMatchCommands("xyzz");
    expect(out.some((c) => c.id === "init")).toBe(false);
  });

  it("respects the limit", () => {
    for (let i = 0; i < 20; i++) {
      registerCommand({
        ...sampleCommand,
        id: `cmd${i}`,
        name: `cmd${i}`,
        slashAliases: [`cmd${i}`],
        shellAliases: [`cmd${i}`],
      });
    }
    expect(fuzzyMatchCommands("", 5)).toHaveLength(5);
  });
});
