import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildKanbanBoard } from "../core/kanban/kanban-builder.js";
import { DEFAULT_KANBAN_CONFIG } from "../core/kanban/kanban-types.js";
import type { KanbanConfig } from "../core/kanban/kanban-types.js";
import { makeNode, makeEdge, makeEpic } from "./helpers/factories.js";

describe("buildKanbanBoard", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Kanban Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should group nodes into columns by status", () => {
    store.insertNode(makeNode({ title: "Backlog 1", status: "backlog" }));
    store.insertNode(makeNode({ title: "Ready 1", status: "ready" }));
    store.insertNode(makeNode({ title: "WIP 1", status: "in_progress" }));
    store.insertNode(makeNode({ title: "Done 1", status: "done" }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);

    expect(board.columns).toHaveLength(5);
    expect(board.columns[0].status).toBe("backlog");
    expect(board.columns[0].cards).toHaveLength(1);
    expect(board.columns[1].status).toBe("ready");
    expect(board.columns[1].cards).toHaveLength(1);
    expect(board.columns[2].status).toBe("in_progress");
    expect(board.columns[2].cards).toHaveLength(1);
    expect(board.columns[4].status).toBe("done");
    expect(board.columns[4].cards).toHaveLength(1);
  });

  it("should sort cards by priority within columns", () => {
    store.insertNode(makeNode({ title: "Low prio", status: "backlog", priority: 5 }));
    store.insertNode(makeNode({ title: "High prio", status: "backlog", priority: 1 }));
    store.insertNode(makeNode({ title: "Mid prio", status: "backlog", priority: 3 }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);

    const backlog = board.columns.find((c) => c.status === "backlog")!;
    expect(backlog.cards[0].node.title).toBe("High prio");
    expect(backlog.cards[1].node.title).toBe("Mid prio");
    expect(backlog.cards[2].node.title).toBe("Low prio");
  });

  it("should identify the next task correctly", () => {
    store.insertNode(makeNode({ title: "Task A", status: "backlog", priority: 3 }));
    store.insertNode(makeNode({ title: "Task B", status: "backlog", priority: 1 }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);

    const backlog = board.columns.find((c) => c.status === "backlog")!;
    const nextCards = backlog.cards.filter((c) => c.isNext);
    expect(nextCards).toHaveLength(1);
    expect(nextCards[0].node.title).toBe("Task B");
  });

  it("should compute blocker and dependency counts", () => {
    const taskA = makeNode({ title: "Task A", status: "done" });
    const taskB = makeNode({ title: "Task B", status: "backlog" });
    const taskC = makeNode({ title: "Task C", status: "backlog" });
    store.insertNode(taskA);
    store.insertNode(taskB);
    store.insertNode(taskC);
    // B depends on A (resolved), C depends on A (resolved) and B (unresolved)
    store.insertEdge(makeEdge(taskB.id, taskA.id));
    store.insertEdge(makeEdge(taskC.id, taskA.id));
    store.insertEdge(makeEdge(taskC.id, taskB.id));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);

    const backlog = board.columns.find((c) => c.status === "backlog")!;
    const cardB = backlog.cards.find((c) => c.node.title === "Task B")!;
    const cardC = backlog.cards.find((c) => c.node.title === "Task C")!;
    expect(cardB.dependencyCount).toBe(1);
    expect(cardB.blockerCount).toBe(0);
    expect(cardC.dependencyCount).toBe(2);
    expect(cardC.blockerCount).toBe(1);
  });

  it("should build swimlanes by epic", () => {
    const epic1 = makeEpic({ title: "Epic 1", status: "in_progress" });
    const epic2 = makeEpic({ title: "Epic 2", status: "backlog" });
    store.insertNode(epic1);
    store.insertNode(epic2);
    store.insertNode(makeNode({ title: "Task 1A", parentId: epic1.id, status: "backlog" }));
    store.insertNode(makeNode({ title: "Task 1B", parentId: epic1.id, status: "ready" }));
    store.insertNode(makeNode({ title: "Task 2A", parentId: epic2.id, status: "backlog" }));
    store.insertNode(makeNode({ title: "Orphan", status: "backlog" }));

    const doc = store.toGraphDocument();
    const config: KanbanConfig = { ...DEFAULT_KANBAN_CONFIG, swimlaneMode: "epic" };
    const board = buildKanbanBoard(doc, config);

    expect(board.swimlanes.length).toBeGreaterThanOrEqual(2);
    const epic1Lane = board.swimlanes.find((s) => s.label === "Epic 1");
    expect(epic1Lane).toBeDefined();
    expect(epic1Lane!.nodeIds).toHaveLength(2);
  });

  it("should build swimlanes by sprint", () => {
    store.insertNode(makeNode({ title: "S1 task", sprint: "Sprint 1", status: "backlog" }));
    store.insertNode(makeNode({ title: "S2 task", sprint: "Sprint 2", status: "ready" }));
    store.insertNode(makeNode({ title: "No sprint", status: "backlog" }));

    const doc = store.toGraphDocument();
    const config: KanbanConfig = { ...DEFAULT_KANBAN_CONFIG, swimlaneMode: "sprint" };
    const board = buildKanbanBoard(doc, config);

    expect(board.swimlanes.length).toBeGreaterThanOrEqual(2);
    const s1 = board.swimlanes.find((s) => s.label === "Sprint 1");
    expect(s1).toBeDefined();
    expect(s1!.nodeIds).toHaveLength(1);
  });

  it("should compute WIP violations", () => {
    store.insertNode(makeNode({ title: "WIP 1", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 2", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 3", status: "in_progress" }));
    store.insertNode(makeNode({ title: "WIP 4", status: "in_progress" }));

    const doc = store.toGraphDocument();
    const config: KanbanConfig = {
      ...DEFAULT_KANBAN_CONFIG,
      wipLimits: { ...DEFAULT_KANBAN_CONFIG.wipLimits, in_progress: 3 },
    };
    const board = buildKanbanBoard(doc, config);

    expect(board.metrics.wipViolations).toHaveLength(1);
    expect(board.metrics.wipViolations[0].column).toBe("in_progress");
    expect(board.metrics.wipViolations[0].actual).toBe(4);
    expect(board.metrics.wipViolations[0].limit).toBe(3);
  });

  it("should handle empty graph", () => {
    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);

    expect(board.columns).toHaveLength(5);
    for (const col of board.columns) {
      expect(col.cards).toHaveLength(0);
    }
    expect(board.swimlanes).toHaveLength(0);
    expect(board.metrics.wipViolations).toHaveLength(0);
  });

  it("should filter tasks only when showOnlyTasks is true", () => {
    store.insertNode(makeEpic({ title: "Epic", status: "backlog" }));
    store.insertNode(makeNode({ title: "Task", type: "task", status: "backlog" }));
    store.insertNode(makeNode({ title: "Requirement", type: "requirement", status: "backlog" }));

    const doc = store.toGraphDocument();

    // showOnlyTasks = true (default)
    const boardTasks = buildKanbanBoard(doc, { ...DEFAULT_KANBAN_CONFIG, showOnlyTasks: true });
    const backlogCards = boardTasks.columns.find((c) => c.status === "backlog")!.cards;
    expect(backlogCards).toHaveLength(1);
    expect(backlogCards[0].node.type).toBe("task");

    // showOnlyTasks = false
    const boardAll = buildKanbanBoard(doc, { ...DEFAULT_KANBAN_CONFIG, showOnlyTasks: false });
    const backlogAll = boardAll.columns.find((c) => c.status === "backlog")!.cards;
    expect(backlogAll.length).toBeGreaterThan(1);
  });

  it("should populate epicTitle on cards when parent is an epic", () => {
    const epic = makeEpic({ title: "Auth Epic", status: "in_progress" });
    store.insertNode(epic);
    store.insertNode(makeNode({ title: "Login Task", parentId: epic.id, status: "backlog" }));

    const doc = store.toGraphDocument();
    const board = buildKanbanBoard(doc, DEFAULT_KANBAN_CONFIG);

    const backlog = board.columns.find((c) => c.status === "backlog")!;
    expect(backlog.cards[0].epicTitle).toBe("Auth Epic");
  });
});
