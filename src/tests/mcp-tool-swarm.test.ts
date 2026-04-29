/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { swarmInputSchema, buildSwarmHandler } from "../mcp/tools/swarm.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

describe("swarmInputSchema — validation", () => {
  it("rejects missing action", () => {
    expect(swarmInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects unknown action", () => {
    expect(swarmInputSchema.safeParse({ action: "destroy" }).success).toBe(false);
  });

  it("accepts action: init with valid config", () => {
    const result = swarmInputSchema.safeParse({
      action: "init",
      topology: "hierarchical",
      consensus: "raft",
      maxAgents: 4,
    });
    expect(result.success).toBe(true);
  });

  it("accepts action: status with sessionId", () => {
    const result = swarmInputSchema.safeParse({ action: "status", sessionId: "sess-1" });
    expect(result.success).toBe(true);
  });

  it("accepts action: scale with sessionId and maxAgents", () => {
    const result = swarmInputSchema.safeParse({ action: "scale", sessionId: "s", maxAgents: 8 });
    expect(result.success).toBe(true);
  });

  it("accepts action: start with sessionId", () => {
    expect(swarmInputSchema.safeParse({ action: "start", sessionId: "s" }).success).toBe(true);
  });

  it("accepts action: stop with sessionId", () => {
    expect(swarmInputSchema.safeParse({ action: "stop", sessionId: "s" }).success).toBe(true);
  });
});

describe("swarm handler — golden path", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  it("init creates a session and returns sessionId in text", async () => {
    const handler = buildSwarmHandler(db);
    const result = await handler({
      action: "init",
      topology: "mesh",
      consensus: "majority",
      maxAgents: 2,
    });
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text as string;
    expect(text).toContain("sessionId");
  });

  it("status returns topology for a known session", async () => {
    const handler = buildSwarmHandler(db);
    const initResult = await handler({ action: "init", topology: "ring", consensus: "raft", maxAgents: 2 });
    const initText = JSON.parse((initResult.content[0].text as string));
    const sessionId: string = initText.sessionId;

    const statusResult = await handler({ action: "status", sessionId });
    expect(statusResult.isError).toBeFalsy();
    const statusText = JSON.parse(statusResult.content[0].text as string);
    expect(statusText.topology).toBe("ring");
  });

  it("status for unknown session returns isError: true", async () => {
    const handler = buildSwarmHandler(db);
    const result = await handler({ action: "status", sessionId: "bogus-id" });
    expect(result.isError).toBe(true);
  });

  it("scale enforces maxAgents ceiling and returns isError: true for 33", async () => {
    const handler = buildSwarmHandler(db);
    const initResult = await handler({ action: "init", topology: "star", consensus: "raft", maxAgents: 4 });
    const { sessionId } = JSON.parse(initResult.content[0].text as string);
    const result = await handler({ action: "scale", sessionId, maxAgents: 33 });
    expect(result.isError).toBe(true);
  });
});

describe("swarm tool — taxonomy entry exists", () => {
  // §SprintA-cleanup — swarm handler is shipped but the MCP tool
  // surface (`swarm` in TOOL_TAXONOMY + server registration) is gated on
  // EPIC-19.T05. Until the tool is registered, taxonomy must NOT list it
  // (profile-registration contract test fails otherwise). Re-enable when
  // the server.ts registration lands.
  it.skip("swarm appears in TOOL_TAXONOMY", async () => {
    const { TOOL_TAXONOMY } = await import("../mcp/tools/taxonomy.js");
    expect(TOOL_TAXONOMY).toHaveProperty("swarm");
  });
});
