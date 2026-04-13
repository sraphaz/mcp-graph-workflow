import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("API /api/v1/graph", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/graph", () => {
    it("should return full graph document", async () => {
      const node = makeNode();
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph");

      expect(res.status).toBe(200);
      expect(res.body.version).toBe("1.0.0");
      expect(res.body.project).toBeDefined();
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.edges).toHaveLength(0);
      expect(res.body.indexes).toBeDefined();
      expect(res.body.meta).toBeDefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBe(1);
    });

    it("should paginate with limit and offset", async () => {
      for (let i = 0; i < 10; i++) {
        ctx.store.insertNode(makeNode({ title: `Task ${i}` }));
      }

      const res = await request(ctx.app).get("/api/v1/graph?limit=3&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBe(10);
      expect(res.body.pagination.limit).toBe(3);
      expect(res.body.pagination.offset).toBe(0);
      expect(res.body.pagination.hasMore).toBe(true);
    });

    it("should filter by status", async () => {
      ctx.store.insertNode(makeNode({ title: "Done task", status: "done" }));
      ctx.store.insertNode(makeNode({ title: "Backlog task", status: "backlog" }));
      ctx.store.insertNode(makeNode({ title: "Another backlog", status: "backlog" }));

      const res = await request(ctx.app).get("/api/v1/graph?status=backlog");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      expect(res.body.nodes.every((n: { status: string }) => n.status === "backlog")).toBe(true);
      expect(res.body.pagination.totalCount).toBe(2);
    });

    it("should filter by type", async () => {
      ctx.store.insertNode(makeNode({ type: "task", title: "A task" }));
      ctx.store.insertNode(makeNode({ type: "epic", title: "An epic" }));
      ctx.store.insertNode(makeNode({ type: "risk", title: "A risk" }));

      const res = await request(ctx.app).get("/api/v1/graph?type=task,epic");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      expect(res.body.pagination.totalCount).toBe(2);
    });

    it("should filter by search term", async () => {
      ctx.store.insertNode(makeNode({ title: "Session tracker module" }));
      ctx.store.insertNode(makeNode({ title: "Database migration" }));

      const res = await request(ctx.app).get("/api/v1/graph?search=session");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.nodes[0].title).toContain("Session");
    });

    it("should combine filters", async () => {
      ctx.store.insertNode(makeNode({ type: "task", status: "done", title: "Done task A" }));
      ctx.store.insertNode(makeNode({ type: "task", status: "backlog", title: "Backlog task" }));
      ctx.store.insertNode(makeNode({ type: "epic", status: "done", title: "Done epic" }));

      const res = await request(ctx.app).get("/api/v1/graph?status=done&type=task");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.nodes[0].title).toBe("Done task A");
    });

    it("should return hasMore=false on last page", async () => {
      for (let i = 0; i < 5; i++) {
        ctx.store.insertNode(makeNode({ title: `Task ${i}` }));
      }

      const res = await request(ctx.app).get("/api/v1/graph?limit=3&offset=3");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    it("should default to limit=100 when no params", async () => {
      const res = await request(ctx.app).get("/api/v1/graph");

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.limit).toBe(100);
      expect(res.body.pagination.offset).toBe(0);
    });

    it("should include edges only for returned nodes", async () => {
      const nodeA = makeNode({ title: "Node A" });
      const nodeB = makeNode({ title: "Node B" });
      const nodeC = makeNode({ title: "Node C" });
      ctx.store.insertNode(nodeA);
      ctx.store.insertNode(nodeB);
      ctx.store.insertNode(nodeC);
      ctx.store.insertEdge(makeEdge(nodeA.id, nodeB.id));
      ctx.store.insertEdge(makeEdge(nodeB.id, nodeC.id));

      const res = await request(ctx.app).get("/api/v1/graph?limit=2&offset=0");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      // edges should only reference nodes in the current page
      for (const edge of res.body.edges) {
        const nodeIds = res.body.nodes.map((n: { id: string }) => n.id);
        expect(nodeIds.includes(edge.from) || nodeIds.includes(edge.to)).toBe(true);
      }
    });
  });

  describe("GET /api/v1/graph/summary", () => {
    it("should return lightweight node summaries", async () => {
      const parent = makeNode({ title: "Epic A", type: "epic" });
      const child = makeNode({ title: "Task A", parentId: parent.id });
      ctx.store.insertNode(parent);
      ctx.store.insertNode(child);

      const res = await request(ctx.app).get("/api/v1/graph/summary");

      expect(res.status).toBe(200);
      expect(res.body.nodes).toHaveLength(2);
      expect(res.body.totalCount).toBe(2);

      const epicSummary = res.body.nodes.find((n: { id: string }) => n.id === parent.id);
      expect(epicSummary).toBeDefined();
      expect(epicSummary.childCount).toBe(1);
      expect(epicSummary.title).toBe("Epic A");
      // Should NOT include heavy fields
      expect(epicSummary.metadata).toBeUndefined();
      expect(epicSummary.description).toBeUndefined();
    });
  });

  describe("GET /api/v1/graph/nodes/:id", () => {
    it("should return full node with edges and related nodes", async () => {
      const nodeA = makeNode({ title: "Node A" });
      const nodeB = makeNode({ title: "Node B" });
      ctx.store.insertNode(nodeA);
      ctx.store.insertNode(nodeB);
      ctx.store.insertEdge(makeEdge(nodeA.id, nodeB.id));

      const res = await request(ctx.app).get(`/api/v1/graph/nodes/${nodeA.id}`);

      expect(res.status).toBe(200);
      expect(res.body.node.id).toBe(nodeA.id);
      expect(res.body.edges).toHaveLength(1);
      expect(res.body.relatedNodes).toHaveLength(1);
      expect(res.body.relatedNodes[0].id).toBe(nodeB.id);
    });

    it("should return 404 for unknown node", async () => {
      const res = await request(ctx.app).get("/api/v1/graph/nodes/node_nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Node not found");
    });

    it("should return children", async () => {
      const parent = makeNode({ title: "Parent" });
      const child1 = makeNode({ title: "Child 1", parentId: parent.id });
      const child2 = makeNode({ title: "Child 2", parentId: parent.id });
      ctx.store.insertNode(parent);
      ctx.store.insertNode(child1);
      ctx.store.insertNode(child2);

      const res = await request(ctx.app).get(`/api/v1/graph/nodes/${parent.id}`);

      expect(res.status).toBe(200);
      expect(res.body.children).toHaveLength(2);
    });
  });

  describe("GET /api/v1/graph/mermaid", () => {
    it("should return mermaid flowchart", async () => {
      const nodeA = makeNode({ title: "Task A" });
      const nodeB = makeNode({ title: "Task B" });
      ctx.store.insertNode(nodeA);
      ctx.store.insertNode(nodeB);

      ctx.store.insertEdge(makeEdge(nodeA.id, nodeB.id));

      const res = await request(ctx.app).get("/api/v1/graph/mermaid");

      expect(res.status).toBe(200);
      expect(res.type).toBe("text/plain");
      expect(res.text).toContain("graph TD");
      expect(res.text).toContain("Task A");
      expect(res.text).toContain("Task B");
      expect(res.text).toContain("depends_on");
    });

    it("should support LR direction", async () => {
      const node = makeNode();
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?direction=LR");

      expect(res.status).toBe(200);
      expect(res.text).toContain("graph LR");
    });

    it("should support mindmap format", async () => {
      const node = makeNode({ title: "Root task" });
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?format=mindmap");

      expect(res.status).toBe(200);
      expect(res.text).toContain("mindmap");
    });

    it("should filter by status", async () => {
      ctx.store.insertNode(makeNode({ title: "Done task", status: "done" }));
      ctx.store.insertNode(makeNode({ title: "Backlog task", status: "backlog" }));

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?status=done");

      expect(res.status).toBe(200);
      expect(res.text).toContain("Done task");
      expect(res.text).not.toContain("Backlog task");
    });
  });

  describe("GET /api/v1/stats", () => {
    it("should return stats", async () => {
      ctx.store.insertNode(makeNode({ type: "task", status: "backlog" }));
      ctx.store.insertNode(makeNode({ type: "epic", status: "done" }));

      const res = await request(ctx.app).get("/api/v1/stats");

      expect(res.status).toBe(200);
      expect(res.body.totalNodes).toBe(2);
      expect(res.body.totalEdges).toBe(0);
      expect(res.body.byType.task).toBe(1);
      expect(res.body.byType.epic).toBe(1);
      expect(res.body.byStatus.backlog).toBe(1);
      expect(res.body.byStatus.done).toBe(1);
    });
  });

  describe("GET /api/v1/search", () => {
    it("should search nodes by query", async () => {
      ctx.store.insertNode(makeNode({ title: "Authentication module" }));
      ctx.store.insertNode(makeNode({ title: "Database migration" }));

      const res = await request(ctx.app).get("/api/v1/search?q=authentication");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Authentication module");
    });

    it("should return 400 when query is missing", async () => {
      const res = await request(ctx.app).get("/api/v1/search");

      expect(res.status).toBe(400);
    });
  });
});
