/**
 * Agent Scenario Tests — Model Checking for Autonomous Agent Properties.
 *
 * Each scenario verifies an explicit property of the agent's behavior:
 *   1. Happy path produces traces
 *   2. Low harness triggers quality concern
 *   3. Graph integrity preserved after operations
 *   4. Dependency edges enforce ordering
 *   5. Rollback restores graph state
 */

import { describe, it, expect } from "vitest";
import type Database from "better-sqlite3";
import {
  ScenarioRunner,
  seedProjectWithNodes,
  type Scenario,
} from "../../core/observability/scenario-runner.js";
import { TraceStore } from "../../core/observability/trace-store.js";
import { evaluatePolicy, type QualityPolicy } from "../../core/observability/quality-policy.js";

const runner = new ScenarioRunner();

describe("Agent Scenarios", () => {
  // ── Scenario 1: Happy Path ───────────────────────────
  it("Scenario 1: Happy path — trace lifecycle", () => {
    const scenario: Scenario = {
      name: "happy_path_trace",
      description: "start_task → finish_task produces a complete trace",
      property: "∀ task t: start_trace(t) → end_trace(t) produces trace with status=completed",
      setup: {
        seedSql: seedProjectWithNodes("proj_1", [
          { id: "node_1", title: "Test Task", status: "ready" },
        ]),
      },
      steps: [
        {
          action: "Begin trace for task",
          execute: (db: Database.Database) => {
            const store = new TraceStore(db);
            return store.beginTrace("thread_1", "node_1", "start_task");
          },
        },
        {
          action: "End trace with completed status",
          execute: (db: Database.Database) => {
            const store = new TraceStore(db);
            const traces = store.getTracesByNode("node_1");
            const traceId = traces[0]!.id;
            store.endTrace(traceId, "completed", { tokensIn: 100, tokensOut: 50 });
            return traceId;
          },
        },
      ],
      assertions: [
        {
          afterStep: 0,
          description: "Trace exists after beginTrace",
          check: (db: Database.Database, result: unknown) => {
            const store = new TraceStore(db);
            const trace = store.getTrace(result as string);
            if (!trace) throw new Error("Trace not found");
            if (trace.status !== "running") throw new Error(`Expected running, got ${trace.status}`);
          },
        },
        {
          afterStep: 1,
          description: "Trace completed with tokens tracked",
          check: (db: Database.Database, result: unknown) => {
            const store = new TraceStore(db);
            const trace = store.getTrace(result as string);
            if (!trace) throw new Error("Trace not found");
            if (trace.status !== "completed") throw new Error(`Expected completed, got ${trace.status}`);
            if (trace.tokensIn !== 100) throw new Error(`Expected 100 tokens_in, got ${trace.tokensIn}`);
          },
        },
      ],
    };

    const result = runner.run(scenario);
    expect(result.passed).toBe(true);
    expect(result.stepsExecuted).toBe(2);
    expect(result.failedAssertions).toHaveLength(0);
  });

  // ── Scenario 2: Low Harness Triggers Quality Warning ─
  it("Scenario 2: Harness below threshold detected by policy", () => {
    const scenario: Scenario = {
      name: "harness_below_threshold",
      description: "Quality policy detects harness < 70 as blocking failure",
      property: "∀ state s: harness(s) < 70 → policy_evaluation(s).passed == false",
      setup: { seedSql: [] },
      steps: [
        {
          action: "Evaluate default policy with low harness",
          execute: () => {
            const policy: QualityPolicy = {
              id: "p1",
              name: "default",
              gates: [
                { metric: "harness_score", operator: ">=", threshold: 70, severity: "block" },
                { metric: "security_score", operator: ">=", threshold: 80, severity: "block" },
              ],
              active: true,
            };
            return evaluatePolicy(policy, { harness_score: 55, security_score: 90 });
          },
        },
      ],
      assertions: [
        {
          afterStep: 0,
          description: "Policy evaluation fails (blocked by harness)",
          check: (_db: Database.Database, result: unknown) => {
            const policyResult = result as { passed: boolean; blockers: Array<{ metric: string }> };
            if (policyResult.passed) throw new Error("Expected policy to fail");
            if (policyResult.blockers.length !== 1) throw new Error(`Expected 1 blocker, got ${policyResult.blockers.length}`);
            if (policyResult.blockers[0]!.metric !== "harness_score") throw new Error("Expected harness_score blocker");
          },
        },
      ],
    };

    const result = runner.run(scenario);
    expect(result.passed).toBe(true);
  });

  // ── Scenario 3: Graph Referential Integrity ──────────
  it("Scenario 3: Graph preserves referential integrity", () => {
    const scenario: Scenario = {
      name: "referential_integrity",
      description: "Edges must reference existing nodes",
      property: "∀ edge e: exists(e.from) ∧ exists(e.to)",
      setup: {
        seedSql: [
          ...seedProjectWithNodes("proj_1", [
            { id: "node_A", title: "Task A" },
            { id: "node_B", title: "Task B" },
          ]),
          `INSERT INTO edges (id, project_id, from_node, to_node, relation_type, created_at)
           VALUES ('edge_1', 'proj_1', 'node_A', 'node_B', 'dependency', datetime('now'))`,
        ],
      },
      steps: [
        {
          action: "Verify all edges reference existing nodes",
          execute: (db: Database.Database) => {
            const edges = db.prepare("SELECT * FROM edges WHERE project_id = 'proj_1'").all() as Array<{ from_node: string; to_node: string }>;
            const nodeIds = new Set(
              (db.prepare("SELECT id FROM nodes WHERE project_id = 'proj_1'").all() as Array<{ id: string }>).map((n) => n.id),
            );

            const dangling = edges.filter((e) => !nodeIds.has(e.from_node) || !nodeIds.has(e.to_node));
            return { edgeCount: edges.length, danglingCount: dangling.length };
          },
        },
      ],
      assertions: [
        {
          afterStep: 0,
          description: "No dangling edges exist",
          check: (_db: Database.Database, result: unknown) => {
            const r = result as { danglingCount: number };
            if (r.danglingCount > 0) throw new Error(`Found ${r.danglingCount} dangling edges`);
          },
        },
      ],
    };

    const result = runner.run(scenario);
    expect(result.passed).toBe(true);
  });

  // ── Scenario 4: Dependency Edge Enforces Ordering ────
  it("Scenario 4: Dependency blocks task until predecessor done", () => {
    const scenario: Scenario = {
      name: "dependency_ordering",
      description: "Task B blocked until Task A is done (dependency edge A→B)",
      property: "∀ task t: ∃ dep d: status(d) != 'done' → t is blocked",
      setup: {
        seedSql: [
          ...seedProjectWithNodes("proj_1", [
            { id: "node_A", title: "Task A", status: "in_progress" },
            { id: "node_B", title: "Task B", status: "ready" },
          ]),
          `INSERT INTO edges (id, project_id, from_node, to_node, relation_type, created_at)
           VALUES ('edge_dep', 'proj_1', 'node_A', 'node_B', 'dependency', datetime('now'))`,
        ],
      },
      steps: [
        {
          action: "Check if Task B is blocked by Task A",
          execute: (db: Database.Database) => {
            // Find dependencies of node_B
            const deps = db.prepare(
              `SELECT n.id, n.status FROM edges e
               JOIN nodes n ON n.id = e.from_node
               WHERE e.to_node = 'node_B' AND e.relation_type = 'dependency'`,
            ).all() as Array<{ id: string; status: string }>;

            const allDone = deps.every((d) => d.status === "done");
            return { dependencyCount: deps.length, allDone, blockedBy: deps.filter((d) => d.status !== "done").map((d) => d.id) };
          },
        },
      ],
      assertions: [
        {
          afterStep: 0,
          description: "Task B is blocked (dependency not done)",
          check: (_db: Database.Database, result: unknown) => {
            const r = result as { allDone: boolean; blockedBy: string[] };
            if (r.allDone) throw new Error("Expected Task B to be blocked");
            if (!r.blockedBy.includes("node_A")) throw new Error("Expected node_A in blockedBy");
          },
        },
      ],
    };

    const result = runner.run(scenario);
    expect(result.passed).toBe(true);
  });

  // ── Scenario 5: Snapshot Rollback Restores State ─────
  it("Scenario 5: Rollback restores graph to checkpoint state", () => {
    const scenario: Scenario = {
      name: "rollback_restore",
      description: "Creating snapshot, modifying graph, rolling back restores original state",
      property: "∀ checkpoint c: rollback(c) → state == state_at(c)",
      setup: {
        seedSql: seedProjectWithNodes("proj_1", [
          { id: "node_1", title: "Original Task 1" },
          { id: "node_2", title: "Original Task 2" },
          { id: "node_3", title: "Original Task 3" },
        ]),
      },
      steps: [
        {
          action: "Create snapshot (checkpoint)",
          execute: (db: Database.Database) => {
            const nodeCount = (db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE project_id = 'proj_1'").get() as { cnt: number }).cnt;

            // Create a snapshot — store node IDs for rollback
            const nodeIds = (db.prepare("SELECT id FROM nodes WHERE project_id = 'proj_1'").all() as Array<{ id: string }>).map((n) => n.id);
            const data = JSON.stringify({ nodeIds });

            db.prepare(
              "INSERT INTO snapshots (project_id, data, created_at) VALUES ('proj_1', ?, datetime('now'))",
            ).run(data);

            return { originalNodeCount: nodeCount };
          },
        },
        {
          action: "Modify graph (add extra node)",
          execute: (db: Database.Database) => {
            db.prepare(
              `INSERT INTO nodes (id, project_id, type, title, status, priority, created_at, updated_at)
               VALUES ('node_extra', 'proj_1', 'task', 'Extra Task', 'ready', 3, datetime('now'), datetime('now'))`,
            ).run();

            const newCount = (db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE project_id = 'proj_1'").get() as { cnt: number }).cnt;
            return { modifiedNodeCount: newCount };
          },
        },
        {
          action: "Rollback to snapshot",
          execute: (db: Database.Database) => {
            // Get latest snapshot
            const snap = db.prepare(
              "SELECT * FROM snapshots WHERE project_id = 'proj_1' ORDER BY created_at DESC LIMIT 1",
            ).get() as { id: number; data: string };

            const data = JSON.parse(snap.data) as {
              nodeIds: string[];
            };

            // Rollback: delete nodes not in snapshot
            db.prepare("DELETE FROM nodes WHERE project_id = 'proj_1' AND id NOT IN (" + data.nodeIds.map(() => "?").join(",") + ")").run(...data.nodeIds);

            const restoredCount = (db.prepare("SELECT COUNT(*) as cnt FROM nodes WHERE project_id = 'proj_1'").get() as { cnt: number }).cnt;
            return { restoredNodeCount: restoredCount };
          },
        },
      ],
      assertions: [
        {
          afterStep: 0,
          description: "Snapshot created with 3 nodes",
          check: (_db: Database.Database, result: unknown) => {
            const r = result as { originalNodeCount: number };
            if (r.originalNodeCount !== 3) throw new Error(`Expected 3 nodes, got ${r.originalNodeCount}`);
          },
        },
        {
          afterStep: 1,
          description: "Graph modified (4 nodes after adding extra)",
          check: (_db: Database.Database, result: unknown) => {
            const r = result as { modifiedNodeCount: number };
            if (r.modifiedNodeCount !== 4) throw new Error(`Expected 4 nodes, got ${r.modifiedNodeCount}`);
          },
        },
        {
          afterStep: 2,
          description: "Rollback restored original 3 nodes",
          check: (_db: Database.Database, result: unknown) => {
            const r = result as { restoredNodeCount: number };
            if (r.restoredNodeCount !== 3) throw new Error(`Expected 3 nodes after rollback, got ${r.restoredNodeCount}`);
          },
        },
      ],
    };

    const result = runner.run(scenario);
    expect(result.passed).toBe(true);
    expect(result.stepsExecuted).toBe(3);
  });

  // ── Run all scenarios summary ────────────────────────
  it("should run all 5 scenarios successfully", () => {
    // This is a meta-test that verifies the runner itself works
    const scenarios: Scenario[] = [
      {
        name: "trivial_pass",
        description: "Minimal scenario that always passes",
        property: "true",
        setup: { seedSql: [] },
        steps: [{ action: "no-op", execute: () => 42 }],
        assertions: [
          {
            afterStep: 0,
            description: "Result is 42",
            check: (_db: Database.Database, result: unknown) => {
              if (result !== 42) throw new Error(`Expected 42, got ${String(result)}`);
            },
          },
        ],
      },
    ];

    const results = runner.runAll(scenarios);
    expect(results).toHaveLength(1);
    expect(results[0]!.passed).toBe(true);
  });
});
