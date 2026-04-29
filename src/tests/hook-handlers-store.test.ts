/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { HookHandlersStore } from "../core/hooks/hook-handlers-store.js";

describe("HookHandlersStore — migration v69 + DAO", () => {
  let db: Database.Database;
  let store: HookHandlersStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new HookHandlersStore(db);
  });

  afterEach(() => db.close());

  it("creates the hook_handlers and hook_handler_stats tables (migration v69 applied)", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'hook_%'")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name).sort();
    expect(names).toContain("hook_handlers");
    expect(names).toContain("hook_handler_stats");
  });

  it("upserts a handler and lists it back", () => {
    store.upsert({
      id: "h1",
      channel: "tool:pre-call",
      kind: "shell",
      command: "/bin/true",
      commandArgs: ["--flag"],
      env: { FOO: "bar" },
      timeoutMs: 1000,
      priority: 0,
    });
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].command).toBe("/bin/true");
    expect(list[0].commandArgs).toEqual(["--flag"]);
    expect(list[0].env).toEqual({ FOO: "bar" });
    expect(list[0].timeoutMs).toBe(1000);
    expect(list[0].origin).toBe("runtime");
    expect(list[0].enabled).toBe(true);
  });

  it("upsert replaces values for the same id (idempotent)", () => {
    store.upsert({ id: "h2", channel: "tool:pre-call", kind: "shell", command: "/bin/old" });
    store.upsert({ id: "h2", channel: "tool:pre-call", kind: "shell", command: "/bin/new" });
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0].command).toBe("/bin/new");
  });

  it("delete removes the row", () => {
    store.upsert({ id: "h3", channel: "tool:post-call", kind: "shell", command: "/bin/true" });
    store.delete("h3");
    expect(store.list()).toHaveLength(0);
  });

  it("list filters out disabled handlers", () => {
    store.upsert({ id: "on", channel: "tool:pre-call", kind: "shell", command: "/bin/true", enabled: true });
    store.upsert({ id: "off", channel: "tool:pre-call", kind: "shell", command: "/bin/true", enabled: false });
    const list = store.list();
    expect(list.map((h) => h.id)).toEqual(["on"]);
  });

  it("orders by priority ASC then created_at ASC", () => {
    store.upsert({ id: "low", channel: "tool:pre-call", kind: "shell", command: "/bin/true", priority: 10 });
    store.upsert({ id: "high", channel: "tool:pre-call", kind: "shell", command: "/bin/true", priority: 0 });
    const ids = store.list().map((h) => h.id);
    expect(ids).toEqual(["high", "low"]);
  });
});
