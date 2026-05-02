/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import {
  deriveFeedbackSignal,
  extractOfferedDocIds,
  applyRagFeedback,
} from "../core/rag/rag-feedback.js";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  db.prepare(
    "INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p', 't', '2026-01-01', '2026-01-01')",
  ).run();
  return db;
}

describe("deriveFeedbackSignal", () => {
  it.each([
    ["F", "passed", 0, "unhelpful"],
    ["D", "passed", 0, "unhelpful"],
    ["A", "passed", 2, "unhelpful"],
    ["A", "passed", 0, "helpful"],
    ["B", "passed", 0, "helpful"],
    ["B", "passed", 1, "helpful"],
    ["A", "failed", 0, "neutral"],
    ["C", "passed", 0, "neutral"],
    ["A", "skipped", 0, "neutral"],
  ])("grade=%s testGate=%s failures=%i → %s", (grade, gate, failures, expected) => {
    expect(
      deriveFeedbackSignal(
        grade as "A" | "B" | "C" | "D" | "F",
        gate as "passed" | "failed" | "skipped" | "blocked",
        failures,
      ),
    ).toBe(expected);
  });
});

describe("extractOfferedDocIds", () => {
  it("returns empty array on empty input", () => {
    expect(extractOfferedDocIds([])).toEqual([]);
  });

  it("collects unique docIds across sections", () => {
    const sections = [
      { citations: [{ docId: "a" }, { docId: "b" }] },
      { citations: [{ docId: "b" }, { docId: "c" }] },
    ];
    expect(extractOfferedDocIds(sections).sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores sections without citations field", () => {
    const sections = [{ citations: [{ docId: "a" }] }, {}];
    expect(extractOfferedDocIds(sections)).toEqual(["a"]);
  });

  it("filters out empty docIds", () => {
    const sections = [{ citations: [{ docId: "" }, { docId: "real" }] }];
    expect(extractOfferedDocIds(sections)).toEqual(["real"]);
  });
});

describe("applyRagFeedback", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("neutral signal is a no-op (skipped count = docIds length)", () => {
    const result = applyRagFeedback(db, ["d1", "d2"], "neutral", "q");
    expect(result).toEqual({ applied: 0, skipped: 2 });
  });

  it("empty docIds returns 0 applied / 0 skipped", () => {
    const result = applyRagFeedback(db, [], "helpful", "q");
    expect(result).toEqual({ applied: 0, skipped: 0 });
  });

  it("unknown docId is skipped (not crashed)", () => {
    const result = applyRagFeedback(db, ["ghost"], "helpful", "q");
    expect(result).toEqual({ applied: 0, skipped: 1 });
  });

  it("known docId increments applied when signal != neutral", () => {
    db.prepare(
      `INSERT INTO knowledge_documents
        (id, source_type, source_id, title, content, content_hash, created_at, updated_at)
       VALUES ('real', 'memory', 'src', 'T', 'C', 'h', '2026-01-01', '2026-01-01')`,
    ).run();
    const result = applyRagFeedback(db, ["real"], "helpful", "test query");
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
