import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { analyzeAcCoverage } from "../../core/analyzer/ac-coverage.js";
import { makeEpic, makeTask, makeSubtask } from "../helpers/factories.js";

describe("analyzeAcCoverage", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("AC Coverage Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return 100% coverage when all tasks have AC", () => {
    const epic = makeEpic({ title: "Epic A" });
    store.insertNode(epic);
    store.insertNode(makeTask({ parentId: epic.id, title: "Task 1", acceptanceCriteria: ["AC1", "AC2"] }));
    store.insertNode(makeTask({ parentId: epic.id, title: "Task 2", acceptanceCriteria: ["AC3"] }));

    const doc = store.toGraphDocument();
    const report = analyzeAcCoverage(doc);

    expect(report.epics).toHaveLength(1);
    expect(report.epics[0].coveragePercent).toBe(100);
    expect(report.epics[0].tasksWithAC).toBe(2);
    expect(report.epics[0].totalTasks).toBe(2);
    expect(report.epics[0].avgACsPerTask).toBe(1.5);
    expect(report.warnings).toHaveLength(0);
    expect(report.overallCoverage).toBe(100);
  });

  it("should return 0% coverage and warning when no tasks have AC", () => {
    const epic = makeEpic({ title: "Epic B" });
    store.insertNode(epic);
    store.insertNode(makeTask({ parentId: epic.id, title: "Task 1" }));
    store.insertNode(makeTask({ parentId: epic.id, title: "Task 2" }));

    const doc = store.toGraphDocument();
    const report = analyzeAcCoverage(doc);

    expect(report.epics).toHaveLength(1);
    expect(report.epics[0].coveragePercent).toBe(0);
    expect(report.epics[0].tasksWithAC).toBe(0);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toContain("Epic B");
    expect(report.warnings[0]).toContain("0 acceptance criteria");
    expect(report.overallCoverage).toBe(0);
  });

  it("should calculate correct percentage for mixed AC coverage", () => {
    const epic = makeEpic({ title: "Epic C" });
    store.insertNode(epic);
    store.insertNode(makeTask({ parentId: epic.id, title: "Task with AC", acceptanceCriteria: ["AC1"] }));
    store.insertNode(makeTask({ parentId: epic.id, title: "Task without AC" }));
    store.insertNode(makeSubtask({ parentId: epic.id, title: "Subtask with AC", acceptanceCriteria: ["AC2", "AC3"] }));

    const doc = store.toGraphDocument();
    const report = analyzeAcCoverage(doc);

    expect(report.epics).toHaveLength(1);
    expect(report.epics[0].totalTasks).toBe(3);
    expect(report.epics[0].tasksWithAC).toBe(2);
    expect(report.epics[0].coveragePercent).toBe(67);
    expect(report.epics[0].avgACsPerTask).toBe(1);
    expect(report.warnings).toHaveLength(0);
  });

  it("should not include epics with no child tasks", () => {
    const epic = makeEpic({ title: "Empty Epic" });
    store.insertNode(epic);

    const doc = store.toGraphDocument();
    const report = analyzeAcCoverage(doc);

    expect(report.epics).toHaveLength(0);
    expect(report.overallCoverage).toBe(100);
  });

  it("should calculate weighted overall coverage across multiple epics", () => {
    const epicA = makeEpic({ title: "Epic A" });
    const epicB = makeEpic({ title: "Epic B" });
    store.insertNode(epicA);
    store.insertNode(epicB);

    // Epic A: 2/2 tasks with AC (100%)
    store.insertNode(makeTask({ parentId: epicA.id, title: "A-T1", acceptanceCriteria: ["AC1"] }));
    store.insertNode(makeTask({ parentId: epicA.id, title: "A-T2", acceptanceCriteria: ["AC2"] }));

    // Epic B: 1/3 tasks with AC (33%)
    store.insertNode(makeTask({ parentId: epicB.id, title: "B-T1", acceptanceCriteria: ["AC3"] }));
    store.insertNode(makeTask({ parentId: epicB.id, title: "B-T2" }));
    store.insertNode(makeTask({ parentId: epicB.id, title: "B-T3" }));

    const doc = store.toGraphDocument();
    const report = analyzeAcCoverage(doc);

    expect(report.epics).toHaveLength(2);
    // Overall: 3 with AC out of 5 total = 60%
    expect(report.overallCoverage).toBe(60);
  });
});
