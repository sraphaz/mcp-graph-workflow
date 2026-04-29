/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset (E18.T08).
 * Tests for proposeAsGolden helper used by finish_task({proposeAsGolden:true}).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import { GoldenStore } from "../core/store/golden-store.js";
import { proposeAsGolden } from "../core/evals/propose-as-golden.js";

describe("proposeAsGolden helper (E18.T08)", () => {
  let db: Database.Database;
  let goldens: GoldenStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    goldens = new GoldenStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("persists a candidate golden with input/output and 'candidate' tag", () => {
    const golden = proposeAsGolden(goldens, {
      input: "task description",
      output: "the implemented solution",
      tool: "finish_task",
      projectId: "p1",
      scorerKind: "exact",
      nodeId: "node_abc",
    });

    expect(golden.id).toBeTruthy();
    expect(golden.input).toBe("task description");
    expect(golden.expected).toBe("the implemented solution");
    expect(golden.tool).toBe("finish_task");
    expect(golden.scorerKind).toBe("exact");
    expect(golden.tags).toContain("candidate");
    expect(golden.metadata.nodeId).toBe("node_abc");
    expect(golden.metadata.proposed).toBe(true);
  });

  it("uses default scorerKind = 'exact' when omitted", () => {
    const golden = proposeAsGolden(goldens, {
      input: "x",
      output: "y",
      tool: "t",
      projectId: "p",
    });
    expect(golden.scorerKind).toBe("exact");
  });

  it("merges extra tags with 'candidate' (no duplicates)", () => {
    const golden = proposeAsGolden(goldens, {
      input: "x",
      output: "y",
      tool: "t",
      projectId: "p",
      tags: ["smoke", "candidate"],
    });
    const candidateCount = golden.tags.filter((t) => t === "candidate").length;
    expect(candidateCount).toBe(1);
    expect(golden.tags).toContain("smoke");
  });

  it("preserves extra metadata fields when provided", () => {
    const golden = proposeAsGolden(goldens, {
      input: "x",
      output: "y",
      tool: "t",
      projectId: "p",
      metadata: { sprint: "s1", risk: "low" },
    });
    expect(golden.metadata.sprint).toBe("s1");
    expect(golden.metadata.risk).toBe("low");
    expect(golden.metadata.proposed).toBe(true);
  });

  it("persisted candidate is retrievable via GoldenStore.listByTag('candidate')", () => {
    proposeAsGolden(goldens, { input: "a", output: "b", tool: "t", projectId: "p" });
    proposeAsGolden(goldens, { input: "c", output: "d", tool: "t", projectId: "p" });
    const candidates = goldens.listByTag("candidate");
    expect(candidates.length).toBe(2);
  });
});
