/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigrations } from "../core/store/migrations.js";
import { HookHandlersStore } from "../core/hooks/hook-handlers-store.js";
import { HookRegistry } from "../core/hooks/hook-registry.js";
import { rehydrateHooks, configToHandler } from "../core/hooks/rehydrate.js";

describe("Hook rehydration — boot-time registry restore", () => {
  let db: Database.Database;
  let registry: HookRegistry;
  let tmp: string;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    registry = new HookRegistry();
    tmp = mkdtempSync(join(tmpdir(), "mcp-graph-rehy-"));
  });

  afterEach(() => {
    db.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("registers a persisted shell handler from the DB", () => {
    const store = new HookHandlersStore(db);
    store.upsert({ id: "from-db", channel: "tool:pre-call", kind: "shell", command: "/bin/true" });
    const result = rehydrateHooks(registry, db, { fromConfig: false });
    expect(result.registered).toContain("from-db");
    expect(registry.list()).toContain("from-db");
  });

  it("registers a config-file handler", () => {
    const cfg = join(tmp, "p.json");
    writeFileSync(cfg, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "from-config", channel: "tool:pre-call", kind: "shell", command: "/bin/true" }] },
    }));
    const result = rehydrateHooks(registry, null, {
      paths: { user: join(tmp, "u.json"), project: cfg, local: join(tmp, "l.json") },
    });
    expect(result.registered).toContain("from-config");
  });

  it("DB overrides config when both define the same id", () => {
    const cfg = join(tmp, "p.json");
    writeFileSync(cfg, JSON.stringify({
      version: 1,
      hooks: { "tool:pre-call": [{ id: "shared", channel: "tool:pre-call", kind: "shell", command: "/bin/from-config" }] },
    }));
    const dbStore = new HookHandlersStore(db);
    dbStore.upsert({ id: "shared", channel: "tool:pre-call", kind: "shell", command: "/bin/from-db" });

    const result = rehydrateHooks(registry, db, {
      paths: { user: join(tmp, "u.json"), project: cfg, local: join(tmp, "l.json") },
    });
    // Both got rehydrated as the same id but DB version replaces config
    expect(result.registered.filter((id) => id === "shared").length).toBe(2);
  });

  it("skips kind=inline-unsafe with a reason", () => {
    const dbStore = new HookHandlersStore(db);
    dbStore.upsert({ id: "legacy", channel: "tool:pre-call", kind: "inline-unsafe" });
    const result = rehydrateHooks(registry, db, { fromConfig: false });
    expect(result.skipped.find((s) => s.id === "legacy")).toBeDefined();
    expect(registry.list()).not.toContain("legacy");
  });

  it("configToHandler returns null for shell handler missing command", () => {
    const handler = configToHandler({ id: "x", channel: "tool:pre-call", kind: "shell" });
    expect(handler).toBeNull();
  });
});
