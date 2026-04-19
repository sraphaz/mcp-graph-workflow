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

/**
 * Tests for GET /api/v1/graph/summary lightweight endpoint.
 *
 * Task 1.2 (node_07c44a27cfd2) — Epic: API Graph Pagination
 *
 * AC1: Returns only essential fields (id, title, type, status, priority, parentId, childCount)
 * AC2: Response size significantly smaller than full graph
 * AC3: Tree items display correctly with minimal data
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/graph/summary", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // ── AC1: Returns only essential fields ──
  describe("AC1: essential fields only", () => {
    it("should return array with only id, title, type, status, priority, parentId, childCount", async () => {
      const epic = makeNode({ id: "epic-1", type: "epic", title: "My Epic" });
      const task = makeNode({ id: "task-1", title: "My Task", parentId: "epic-1" });
      ctx.store.insertNode(epic);
      ctx.store.insertNode(task);

      const res = await request(ctx.app).get("/api/v1/graph/summary");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.nodes)).toBe(true);
      expect(res.body.nodes).toHaveLength(2);

      const node = res.body.nodes.find((n: { id: string }) => n.id === "task-1");
      expect(node).toBeDefined();
      expect(node.id).toBe("task-1");
      expect(node.title).toBe("My Task");
      expect(node.type).toBe("task");
      expect(node.status).toBeDefined();
      expect(node.priority).toBeDefined();
      expect(node.parentId).toBe("epic-1");
      expect(typeof node.childCount).toBe("number");

      // Should NOT have heavy fields
      expect(node.description).toBeUndefined();
      expect(node.metadata).toBeUndefined();
      expect(node.acceptanceCriteria).toBeUndefined();
      expect(node.sourceRef).toBeUndefined();
    });

    it("should compute childCount correctly", async () => {
      const epic = makeNode({ id: "epic-1", type: "epic", title: "Epic" });
      const task1 = makeNode({ id: "task-1", title: "Task 1", parentId: "epic-1" });
      const task2 = makeNode({ id: "task-2", title: "Task 2", parentId: "epic-1" });
      const task3 = makeNode({ id: "task-3", title: "Task 3" }); // orphan
      ctx.store.insertNode(epic);
      ctx.store.insertNode(task1);
      ctx.store.insertNode(task2);
      ctx.store.insertNode(task3);

      const res = await request(ctx.app).get("/api/v1/graph/summary");

      const epicNode = res.body.nodes.find((n: { id: string }) => n.id === "epic-1");
      expect(epicNode.childCount).toBe(2);

      const orphan = res.body.nodes.find((n: { id: string }) => n.id === "task-3");
      expect(orphan.childCount).toBe(0);
    });
  });

  // ── AC2: Response size is smaller ──
  describe("AC2: lightweight response", () => {
    it("should return totalCount in response", async () => {
      for (let i = 0; i < 10; i++) {
        ctx.store.insertNode(makeNode({ title: `Task ${i}` }));
      }

      const res = await request(ctx.app).get("/api/v1/graph/summary");

      expect(res.status).toBe(200);
      expect(res.body.totalCount).toBe(10);
    });

    it("should have smaller payload than full graph endpoint", async () => {
      for (let i = 0; i < 20; i++) {
        ctx.store.insertNode(
          makeNode({
            title: `Task ${i} with some description`,
            description: `This is a longer description for task ${i} that includes acceptance criteria and other metadata that takes up space.`,
          }),
        );
      }

      const summaryRes = await request(ctx.app).get("/api/v1/graph/summary");
      const fullRes = await request(ctx.app).get("/api/v1/graph");

      const summarySize = JSON.stringify(summaryRes.body).length;
      const fullSize = JSON.stringify(fullRes.body).length;

      // Summary should be significantly smaller
      expect(summarySize).toBeLessThan(fullSize);
    });
  });

  // ── Empty graph ──
  describe("edge cases", () => {
    it("should return empty array for empty graph", async () => {
      const res = await request(ctx.app).get("/api/v1/graph/summary");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(0);
      expect(res.body.totalCount).toBe(0);
    });
  });
});
