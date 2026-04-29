/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installFsWatcher } from "../core/hooks/fs-watcher.js";
import { HookDedupStore } from "../core/hooks/dedup-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import { HookBus } from "../core/hooks/hook-bus.js";
import { setSharedHookBus } from "../core/hooks/shared-hook-bus.js";
import type { HookEvent } from "../core/hooks/hook-types.js";

describe("fs-watcher — emits tool:post-call for file changes", () => {
  let tmp: string;
  let bus: HookBus;
  let captured: HookEvent[];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "mcp-fsw-"));
    bus = new HookBus(new GraphEventBus());
    setSharedHookBus(bus);
    captured = [];
    bus.on("tool:post-call", async (e) => { captured.push(e); });
  });

  afterEach(() => {
    setSharedHookBus(null);
    rmSync(tmp, { recursive: true, force: true });
  });

  it("emits when a new file is created", async () => {
    const dispose = installFsWatcher({ basePath: tmp, debounceMs: 50 });
    await new Promise((r) => setTimeout(r, 50));
    writeFileSync(join(tmp, "alpha.ts"), "x = 1");
    await new Promise((r) => setTimeout(r, 250));

    const evts = captured.filter((e) => (e.payload.filePath as string).endsWith("alpha.ts"));
    expect(evts.length).toBeGreaterThan(0);
    expect(evts[0].channel).toBe("tool:post-call");
    expect(["Write", "Edit"]).toContain(evts[0].payload.toolName as string);
    dispose();
  });

  it("does NOT emit for files in node_modules", async () => {
    mkdirSync(join(tmp, "node_modules"));
    const dispose = installFsWatcher({ basePath: tmp, debounceMs: 50 });
    await new Promise((r) => setTimeout(r, 50));
    writeFileSync(join(tmp, "node_modules", "pkg.json"), "{}");
    await new Promise((r) => setTimeout(r, 250));

    const evts = captured.filter((e) => (e.payload.filePath as string).includes("node_modules"));
    expect(evts).toHaveLength(0);
    dispose();
  });

  it("attributes events via inferAgentSource", async () => {
    const dispose = installFsWatcher({
      basePath: tmp,
      debounceMs: 50,
      inferAgentSource: () => "cursor",
    });
    await new Promise((r) => setTimeout(r, 50));
    writeFileSync(join(tmp, "beta.ts"), "y = 2");
    await new Promise((r) => setTimeout(r, 250));

    const cursorEvts = captured.filter((e) => e.payload.agentSource === "cursor");
    expect(cursorEvts.length).toBeGreaterThan(0);
    dispose();
  });

  it("dedupStore suppresses MCP+fs-watcher double-fire", async () => {
    const dedup = new HookDedupStore(500);
    const dispose = installFsWatcher({
      basePath: tmp,
      debounceMs: 50,
      inferAgentSource: () => "cursor",
      dedupStore: dedup,
    });
    await new Promise((r) => setTimeout(r, 50));

    // Simulate MCP path having already fired for this file
    dedup.recordEmission("cursor:gamma.ts:Write");
    dedup.recordEmission("cursor:gamma.ts:Edit");

    writeFileSync(join(tmp, "gamma.ts"), "z = 3");
    await new Promise((r) => setTimeout(r, 250));

    const evts = captured.filter((e) => (e.payload.filePath as string).endsWith("gamma.ts"));
    expect(evts).toHaveLength(0);
    dispose();
  });

  it("emits Delete on unlink", async () => {
    const file = join(tmp, "delta.ts");
    writeFileSync(file, "w = 4");
    await new Promise((r) => setTimeout(r, 50));
    const dispose = installFsWatcher({ basePath: tmp, debounceMs: 50 });
    await new Promise((r) => setTimeout(r, 50));
    unlinkSync(file);
    await new Promise((r) => setTimeout(r, 250));

    const deleteEvts = captured.filter((e) => e.payload.toolName === "Delete" && (e.payload.filePath as string).endsWith("delta.ts"));
    expect(deleteEvts.length).toBeGreaterThan(0);
    dispose();
  });
});
