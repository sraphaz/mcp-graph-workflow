import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SessionRecallStore } from "../core/context/session-recall.js";
import { runMigrations } from "../core/store/migrations.js";

describe("SessionRecallStore", () => {
  let db: Database.Database;
  let store: SessionRecallStore;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    store = new SessionRecallStore(db);
  });

  it("should save and retrieve a session summary", () => {
    store.saveSessionSummary({
      sessionId: "sess_1",
      summary: "Implemented JWT authentication and token validation middleware",
      topics: ["authentication", "JWT", "middleware"],
      nodeIds: ["node_abc"],
    });

    const results = store.recallSessions("authentication");
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("sess_1");
    expect(results[0].summary).toContain("JWT");
  });

  it("should search across multiple sessions with FTS5", () => {
    store.saveSessionSummary({
      sessionId: "sess_1",
      summary: "Set up database migrations and schema validation",
      topics: ["database", "migrations"],
    });
    store.saveSessionSummary({
      sessionId: "sess_2",
      summary: "Implemented user authentication with JWT tokens",
      topics: ["auth", "JWT"],
    });
    store.saveSessionSummary({
      sessionId: "sess_3",
      summary: "Fixed database connection pooling bug",
      topics: ["database", "bugfix"],
    });

    const dbResults = store.recallSessions("database");
    expect(dbResults.length).toBeGreaterThanOrEqual(2);

    const authResults = store.recallSessions("authentication JWT");
    expect(authResults.length).toBeGreaterThanOrEqual(1);
  });

  it("should support parent_session_id for chaining", () => {
    store.saveSessionSummary({
      sessionId: "sess_parent",
      summary: "Started sprint planning for auth epic",
      topics: ["planning"],
    });
    store.saveSessionSummary({
      sessionId: "sess_child",
      parentSessionId: "sess_parent",
      summary: "Continued auth implementation from parent session",
      topics: ["auth", "implementation"],
    });

    const chain = store.getSessionChain("sess_child");
    expect(chain).toHaveLength(2);
    expect(chain[0].sessionId).toBe("sess_parent");
    expect(chain[1].sessionId).toBe("sess_child");
  });

  it("should return empty array for nonexistent session chain", () => {
    const chain = store.getSessionChain("nonexistent");
    expect(chain).toEqual([]);
  });

  it("should return empty array when no sessions match query", () => {
    store.saveSessionSummary({
      sessionId: "sess_1",
      summary: "Database setup",
      topics: ["database"],
    });

    const results = store.recallSessions("quantum_physics_xyz");
    expect(results).toEqual([]);
  });

  it("should handle duplicate session IDs gracefully", () => {
    store.saveSessionSummary({
      sessionId: "sess_1",
      summary: "First version",
      topics: ["v1"],
    });
    // Second save with same ID should update
    store.saveSessionSummary({
      sessionId: "sess_1",
      summary: "Updated version",
      topics: ["v2"],
    });

    const results = store.recallSessions("updated");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});
