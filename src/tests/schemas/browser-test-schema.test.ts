/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Task 4.1 — Schema browser_test + migration
 *
 * AC1: GIVEN schema WHEN z.infer THEN tipo BrowserTestNode exportado
 * AC2: GIVEN node({type:"browser_test", ...}) WHEN validado THEN aceita payload
 * AC3: GIVEN migration aplicada WHEN insert THEN campos JSON persistem
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { BrowserTestNodeSchema, type BrowserTestNode } from "../../schemas/browser-test.schema.js";
import { NodeTypeSchema } from "../../schemas/node.schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

const validPayload = {
  runId: "run_abc123",
  targetUrl: "https://example.com/login",
  featureNodeId: "node_feat_001",
  status: "pass" as const,
  evidences: [{ selector: "#btn", action: "click", screenshot: "s3://bucket/img.png" }],
  pathTaken: ["/login", "/dashboard"],
  startedAt: "2026-05-09T10:00:00Z",
  endedAt: "2026-05-09T10:00:05Z",
};

// ---------------------------------------------------------------------------
// AC1: BrowserTestNode type exported via z.infer
// ---------------------------------------------------------------------------

describe("BrowserTestNodeSchema — AC1: type exported", () => {
  it("should export BrowserTestNode type (compile-time check via assignment)", () => {
    const result = BrowserTestNodeSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const node: BrowserTestNode = result.data;
    expect(node.runId).toBe("run_abc123");
  });

  it("should accept optional fields as undefined", () => {
    const result = BrowserTestNodeSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.adrNodeId).toBeUndefined();
    expect(result.data.unitTestPath).toBeUndefined();
  });

  it("should reject invalid status value", () => {
    const result = BrowserTestNodeSchema.safeParse({ ...validPayload, status: "unknown" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC2: NodeTypeSchema includes browser_test
// ---------------------------------------------------------------------------

describe("NodeTypeSchema — AC2: accepts browser_test type", () => {
  it("should include browser_test in the node type enum", () => {
    const result = NodeTypeSchema.safeParse("browser_test");
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: migration — INSERT with JSON fields persists correctly
// ---------------------------------------------------------------------------

describe("browser_test_runs migration — AC3: JSON fields persist", () => {
  it("should insert and retrieve a browser_test_run row with JSON columns", () => {
    const evidences = JSON.stringify(validPayload.evidences);
    const pathTaken = JSON.stringify(validPayload.pathTaken);

    db.prepare(
      `INSERT INTO browser_test_runs
         (id, runId, targetUrl, featureNodeId, status, evidences, pathTaken, startedAt, endedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "btr_001",
      validPayload.runId,
      validPayload.targetUrl,
      validPayload.featureNodeId,
      validPayload.status,
      evidences,
      pathTaken,
      validPayload.startedAt,
      validPayload.endedAt
    );

    const row = db.prepare("SELECT * FROM browser_test_runs WHERE id = ?").get("btr_001") as {
      evidences: string;
      pathTaken: string;
    };
    expect(row).toBeDefined();
    expect(JSON.parse(row.evidences)).toHaveLength(1);
    expect(JSON.parse(row.pathTaken)).toEqual(["/login", "/dashboard"]);
  });
});
