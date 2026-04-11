import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { validateMove } from "../core/kanban/kanban-validator.js";
import { DEFAULT_KANBAN_CONFIG } from "../core/kanban/kanban-types.js";
import type { KanbanConfig } from "../core/kanban/kanban-types.js";
import { makeNode, makeEdge, makeDoneTask } from "./helpers/factories.js";

describe("validateMove", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Kanban Validator Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should allow valid transitions", () => {
    const task = makeNode({ title: "Task", status: "backlog" });
    store.insertNode(task);

    const result = validateMove(store, task.id, "ready", DEFAULT_KANBAN_CONFIG);
    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe("backlog");
    expect(result.newStatus).toBe("ready");
    expect(result.warnings).toHaveLength(0);
  });

  it("should warn on done transition with unresolved deps", () => {
    const dep = makeNode({ title: "Dependency", status: "backlog" });
    const task = makeNode({ title: "Task", status: "in_progress" });
    store.insertNode(dep);
    store.insertNode(task);
    store.insertEdge(makeEdge(task.id, dep.id));

    const result = validateMove(store, task.id, "done", DEFAULT_KANBAN_CONFIG);
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("unresolved dependencies");
  });

  it("should warn on WIP limit violation", () => {
    store.insertNode(makeNode({ title: "WIP 1", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 2", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 3", status: "in_progress" }));
    const task = makeNode({ title: "Moving to WIP", status: "ready" });
    store.insertNode(task);

    const config: KanbanConfig = {
      ...DEFAULT_KANBAN_CONFIG,
      wipLimits: { ...DEFAULT_KANBAN_CONFIG.wipLimits, in_progress: 3 },
    };

    const result = validateMove(store, task.id, "in_progress", config);
    expect(result.success).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("WIP limit"))).toBe(true);
  });

  it("should fail when node does not exist", () => {
    const result = validateMove(store, "nonexistent", "ready", DEFAULT_KANBAN_CONFIG);
    expect(result.success).toBe(false);
    expect(result.warnings[0]).toContain("not found");
  });

  it("should allow done transition when all deps are resolved", () => {
    const dep = makeDoneTask({ title: "Done dep" });
    const task = makeNode({ title: "Task", status: "in_progress" });
    store.insertNode(dep);
    store.insertNode(task);
    store.insertEdge(makeEdge(task.id, dep.id));

    const result = validateMove(store, task.id, "done", DEFAULT_KANBAN_CONFIG);
    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});
