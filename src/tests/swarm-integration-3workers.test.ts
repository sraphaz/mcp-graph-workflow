/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T06).
 * Integration: queen + 3 workers + majority consensus + golden eval.
 *
 * AC6 of EPIC 19: golden suite must show ≤2% degradation vs single-agent.
 * Wires SwarmCoordinator (T01) + hierarchical topology (T02) + majority
 * consensus (T04) + GoldenStore/runEvals (EPIC 18) end-to-end with
 * deterministic simulated worker outputs (no real LLMs).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { SwarmCoordinator } from "../core/swarm/swarm-coordinator.js";
import { GoldenStore } from "../core/store/golden-store.js";
import { EvalRunStore } from "../core/store/eval-run-store.js";
import { runEvals, type EvalDispatch } from "../core/evals/eval-runner.js";
import { buildHierarchicalLayout } from "../core/swarm/topologies/hierarchical.js";
import { computeMajorityConsensus } from "../core/swarm/consensus/majority.js";

interface WorkerVote {
  agentId: string;
  output: string;
}

/**
 * Simulates a queen dispatching a golden to N workers with slight variance,
 * then aggregating their outputs via majority consensus. The output that
 * wins consensus is what runEvals scores against `expected`.
 */
function makeSwarmDispatch(opts: {
  workers: string[];
  /** Deterministic per-worker output mutation given the expected. */
  workerOutput: (agentId: string, expected: string) => string;
}): EvalDispatch {
  return async (golden) => {
    const votes: WorkerVote[] = opts.workers.map((agentId) => ({
      agentId,
      output: opts.workerOutput(agentId, golden.expected),
    }));
    const consensus = computeMajorityConsensus(
      votes.map((v) => ({ agentId: v.agentId, value: v.output })),
    );
    // Fall back to first worker output when no majority reached.
    const finalOutput = consensus.winner ?? votes[0]!.output;
    return { output: finalOutput, modelUsed: "swarm-3w", costUsd: 0.001 };
  };
}

describe("swarm integration: queen + 3 workers + golden eval (E19.T06)", () => {
  let db: Database.Database;
  let coord: SwarmCoordinator;
  let goldens: GoldenStore;
  let runs: EvalRunStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    coord = new SwarmCoordinator(db);
    goldens = new GoldenStore(db);
    runs = new EvalRunStore(db);

    // Seed 10 goldens for "analyze" tool.
    for (let i = 0; i < 10; i++) {
      goldens.create({
        input: `q${i}`,
        expected: `ans${i}`,
        scorerKind: "exact",
        tool: "analyze",
        projectId: "p",
        metadata: {},
        tags: [],
      });
    }
  });

  afterEach(() => {
    db.close();
  });

  it("hierarchical layout has queen + 3 workers", () => {
    const session = coord.init({
      topology: "hierarchical",
      consensus: "majority",
      maxAgents: 4,
      strategy: "specialized",
    });
    expect(session.status).toBe("pending");

    const agents = ["queen", "w1", "w2", "w3"];
    const layout = buildHierarchicalLayout(agents);
    expect(layout.queen).toBe("queen");
    expect(layout.workers).toEqual(["w1", "w2", "w3"]);
    expect(layout.dispatch.queen?.length).toBe(3);
    expect(Object.keys(layout.report).length).toBe(3);
  });

  it("3-worker majority recovers when 1 worker is wrong (≤2% degradation)", async () => {
    // Single-agent baseline: one worker with 100% accuracy.
    const singleAgentDispatch: EvalDispatch = async (g) => ({
      output: g.expected,
      modelUsed: "single",
      costUsd: 0.001,
    });
    const baseline = await runEvals({ goldens, runs, dispatch: singleAgentDispatch });
    expect(baseline.passRate).toBe(1);

    // 3-worker swarm: 2 correct, 1 wrong → majority still picks correct.
    const swarmDispatch = makeSwarmDispatch({
      workers: ["w1", "w2", "w3"],
      workerOutput: (agentId, expected) => (agentId === "w3" ? "WRONG" : expected),
    });
    const swarmRun = await runEvals({ goldens, runs, dispatch: swarmDispatch });

    expect(swarmRun.passRate).toBe(1);
    const degradation = baseline.passRate - swarmRun.passRate;
    expect(degradation).toBeLessThanOrEqual(0.02); // AC6: ≤2%
  });

  it("3-worker majority fails closed when 2+ workers are wrong", async () => {
    const swarmDispatch = makeSwarmDispatch({
      workers: ["w1", "w2", "w3"],
      workerOutput: (agentId, expected) => (agentId === "w1" ? expected : "WRONG"),
    });
    const swarmRun = await runEvals({ goldens, runs, dispatch: swarmDispatch });
    // Majority of workers (w2+w3) agree on WRONG → consensus = WRONG → all fail.
    expect(swarmRun.passRate).toBe(0);
  });

  it("eval_run rows are persisted under one runId for the swarm session", async () => {
    const swarmDispatch = makeSwarmDispatch({
      workers: ["w1", "w2", "w3"],
      workerOutput: (_a, expected) => expected,
    });
    const run = await runEvals({ goldens, runs, dispatch: swarmDispatch });
    const rows = runs.listByRunId(run.runId);
    expect(rows.length).toBe(10);
    for (const r of rows) {
      expect(r.modelUsed).toBe("swarm-3w");
    }
  });

  it("swarm session persists members for queen + 3 workers", () => {
    const session = coord.init({
      topology: "hierarchical",
      consensus: "majority",
      maxAgents: 4,
      strategy: "specialized",
    });
    coord.start(session.id);

    const now = new Date().toISOString();
    db.prepare(
      "INSERT INTO swarm_agents (id, session_id, role, status, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run("queen", session.id, "queen", "idle", now);
    for (const w of ["w1", "w2", "w3"]) {
      db.prepare(
        "INSERT INTO swarm_agents (id, session_id, role, status, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(w, session.id, "worker", "idle", now);
    }

    const rows = db
      .prepare("SELECT role FROM swarm_agents WHERE session_id = ? ORDER BY id")
      .all(session.id) as Array<{ role: string }>;
    expect(rows.length).toBe(4);
    const queens = rows.filter((r) => r.role === "queen").length;
    const workers = rows.filter((r) => r.role === "worker").length;
    expect(queens).toBe(1);
    expect(workers).toBe(3);

    coord.stop(session.id);
    const after = db
      .prepare("SELECT * FROM swarm_agents WHERE session_id = ?")
      .all(session.id);
    expect(after).toHaveLength(0);
  });
});
