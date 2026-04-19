/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SessionChainManager } from "../core/context/session-chain.js";
import { SessionRecallStore } from "../core/context/session-recall.js";
import { runMigrations } from "../core/store/migrations.js";

describe("SessionChainManager", () => {
  let db: Database.Database;
  let recallStore: SessionRecallStore;
  let chain: SessionChainManager;

  beforeEach(() => {
    db = new Database(":memory:");
    runMigrations(db);
    recallStore = new SessionRecallStore(db);
    chain = new SessionChainManager(recallStore);
  });

  it("should create a child session linked to parent", () => {
    recallStore.saveSessionSummary({
      sessionId: "parent_1",
      summary: "Initial sprint planning",
      topics: ["planning"],
    });

    const childId = chain.createChildSession("parent_1", "compression_pressure");

    expect(childId).toBeTruthy();
    const childSummary = recallStore.getBySessionId(childId);
    expect(childSummary).not.toBeNull();
    expect(childSummary!.parentSessionId).toBe("parent_1");
  });

  it("should build session lineage from child to root", () => {
    recallStore.saveSessionSummary({
      sessionId: "root",
      summary: "Root session",
      topics: ["init"],
    });
    const child1 = chain.createChildSession("root", "split");
    const child2 = chain.createChildSession(child1, "split");

    const lineage = chain.getSessionLineage(child2);
    expect(lineage).toHaveLength(3);
    expect(lineage[0].sessionId).toBe("root");
    expect(lineage[2].sessionId).toBe(child2);
  });

  it("should return empty lineage for nonexistent session", () => {
    const lineage = chain.getSessionLineage("nonexistent");
    expect(lineage).toEqual([]);
  });

  it("should include reason in child session summary", () => {
    recallStore.saveSessionSummary({
      sessionId: "parent_2",
      summary: "Working on auth",
      topics: ["auth"],
    });

    const childId = chain.createChildSession("parent_2", "budget_exceeded");

    const child = recallStore.getBySessionId(childId);
    expect(child!.summary).toContain("budget_exceeded");
  });
});
