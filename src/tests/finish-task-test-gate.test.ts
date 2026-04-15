import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import { runTestGate } from "../core/harness/test-gate.js";

describe("Test Gate for finish_task (DORA Shift-Left)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Gate Project");
  });

  afterEach(() => {
    store.close();
  });

  it("should return skipped when node has no testFiles", async () => {
    const node = makeNode({
      id: "task-no-tests",
      title: "Task without tests",
      status: "in_progress",
    });
    store.insertNode(node);

    const result = await runTestGate(store, "task-no-tests", "advisory");

    expect(result.status).toBe("skipped");
    expect(result.blocked).toBe(false);
  });

  it("should return skipped when mode is off", async () => {
    const node = makeNode({
      id: "task-off",
      title: "Task with off gate",
      status: "in_progress",
      testFiles: ["src/tests/migration-46-contract-violations.test.ts"],
    });
    store.insertNode(node);

    const result = await runTestGate(store, "task-off", "off");

    expect(result.status).toBe("skipped");
    expect(result.blocked).toBe(false);
  });

  it("should return passed when tests pass in advisory mode", async () => {
    const node = makeNode({
      id: "task-pass",
      title: "Task with passing tests",
      status: "in_progress",
      testFiles: ["src/tests/migration-46-contract-violations.test.ts"],
    });
    store.insertNode(node);

    const result = await runTestGate(store, "task-pass", "advisory");

    expect(result.status).toBe("passed");
    expect(result.blocked).toBe(false);
    expect(result.passed).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
  }, 30000);

  it("should return failed but not blocked in advisory mode for failing tests", async () => {
    const node = makeNode({
      id: "task-fail-advisory",
      title: "Task with failing tests advisory",
      status: "in_progress",
      testFiles: ["src/tests/__nonexistent__.test.ts"],
    });
    store.insertNode(node);

    const result = await runTestGate(store, "task-fail-advisory", "advisory");

    expect(result.status).toBe("failed");
    expect(result.blocked).toBe(false); // advisory = don't block
  }, 30000);

  it("should return failed AND blocked in strict mode for failing tests", async () => {
    const node = makeNode({
      id: "task-fail-strict",
      title: "Task with failing tests strict",
      status: "in_progress",
      testFiles: ["src/tests/__nonexistent__.test.ts"],
    });
    store.insertNode(node);

    const result = await runTestGate(store, "task-fail-strict", "strict");

    expect(result.status).toBe("failed");
    expect(result.blocked).toBe(true); // strict = block
  }, 30000);
});
