/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * T4.2 — registerAllTools(server, store, profile) must filter the
 * surface so that only tools visible at the requested profile end up
 * registered. Backward-compat: default `profile = "all"` keeps every
 * pre-T4.2 behaviour.
 */

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { registerAllTools } from "../mcp/tools/index.js";
import {
  listToolsForProfile,
  type ProfileFilter,
} from "../mcp/tools/taxonomy.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyServer = any;

function registeredToolNames(server: McpServer): Set<string> {
  const map = (server as AnyServer)._registeredTools as Record<string, unknown>;
  return new Set(Object.keys(map));
}

function makeServer(): McpServer {
  return new McpServer(
    { name: "test", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );
}

describe("registerAllTools — profile filter (T4.2)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("default profile = 'all' registers every classified tool (zero behaviour change)", async () => {
    const server = makeServer();
    await registerAllTools(server, store);
    const registered = registeredToolNames(server);
    const expected = new Set(listToolsForProfile("all"));
    // every expected tool was registered (no missing from the surface)
    for (const name of expected) {
      expect(registered.has(name), `default 'all' missing tool ${name}`).toBe(true);
    }
  });

  it("profile = 'core' registers only the core daily-loop tools", async () => {
    const server = makeServer();
    await registerAllTools(server, store, "core");
    const registered = registeredToolNames(server);
    const expected = new Set(listToolsForProfile("core"));
    expect(registered).toEqual(expected);
  });

  it("profile = 'core' registration shape — exactly 8 tools (counter util / T2.5 lazy-import gate)", async () => {
    // T2.5 — registerAllTools uses dynamic `await import()` inside each profile
    // gate. With profile='core' only the 8 core tool modules should evaluate;
    // pro/expert modules are not pulled in. A drop-down counter against the
    // registered surface is the simplest cache-shape assertion that survives
    // future re-classifications: the count tracks listToolsForProfile('core').
    const server = makeServer();
    await registerAllTools(server, store, "core");
    const registered = registeredToolNames(server);
    const coreCount = listToolsForProfile("core").length;
    expect(coreCount, "T4.0 contracted core size").toBe(8);
    expect(registered.size, "registered must equal core count — no leakage from lazy gate").toBe(coreCount);
  });

  it("profile = 'pro' registers core + pro tools (inclusive hierarchy)", async () => {
    const server = makeServer();
    await registerAllTools(server, store, "pro");
    const registered = registeredToolNames(server);
    const expected = new Set(listToolsForProfile("pro"));
    expect(registered).toEqual(expected);
  });

  it("profile = 'expert' registers everything classified", async () => {
    const server = makeServer();
    await registerAllTools(server, store, "expert");
    const registered = registeredToolNames(server);
    const expected = new Set(listToolsForProfile("expert"));
    expect(registered).toEqual(expected);
  });

  it.each(["core", "pro", "expert", "all"] as ProfileFilter[])(
    "profile = %s — registered set is a subset of taxonomy entries",
    async (profile) => {
      const server = makeServer();
      await registerAllTools(server, store, profile);
      const registered = registeredToolNames(server);
      const allowed = new Set(listToolsForProfile(profile));
      for (const name of registered) {
        expect(allowed.has(name), `profile '${profile}' registered un-allowed tool ${name}`).toBe(true);
      }
    },
  );
});
