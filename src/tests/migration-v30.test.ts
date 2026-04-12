import { describe, it, expect, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";

describe("Migration v30 — schema cleanup", () => {
  let store: SqliteStore;

  afterEach(() => {
    store?.close();
  });

  it("should complete migration v30 successfully", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    // Check migration v30 was applied
    const db = (store as unknown as { db: Database.Database }).db;
    const applied = db.prepare("SELECT version FROM _migrations WHERE version = 30").get();
    expect(applied).toBeDefined();
  });

  it("should run migration in under 5 seconds on empty DB", () => {
    const start = Date.now();
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });

  it("should have FTS index working after migration", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    // Insert a node with searchable content
    const node = makeNode({
      title: "Findable unique keyword zxcvbn",
      description: "This node should be searchable via FTS",
    });
    store.insertNode(node);

    // Search should find the node via FTS
    const results = store.searchNodes("zxcvbn");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(node.id);
  });

  it("should ensure blocked field defaults to false for new nodes", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    const node = makeNode({ title: "Node without blocked" });
    store.insertNode(node);

    const fetched = store.getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.blocked).toBe(false);
  });

  it("should ensure status and priority are always set", () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");

    const node = makeNode({ title: "Node with defaults" });
    store.insertNode(node);

    const fetched = store.getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.status).toBe("backlog");
    expect(fetched!.priority).toBe(3);
  });
});
