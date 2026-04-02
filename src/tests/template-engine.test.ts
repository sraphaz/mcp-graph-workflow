import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import {
  instantiateTemplate,
  listTemplates,
  type TaskTemplate,
} from "../core/templates/template-engine.js";

describe("template-engine", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Template Test");
  });

  afterEach(() => {
    store.close();
  });

  // ── Variable Substitution ─────────────────────

  it("should substitute variables in titles and acceptance criteria", () => {
    const template: TaskTemplate = {
      name: "Feature Template",
      nodeDefinitions: [
        {
          type: "task",
          titleTemplate: "{{name}} — Backend API",
          acceptanceCriteria: ["{{name}} endpoint returns 200"],
          tags: ["backend"],
        },
      ],
    };

    const result = instantiateTemplate(store, template, { name: "Users" });

    expect(result.nodesCreated).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const node = store.getNodeById(result.nodesCreated[0]);
    expect(node).not.toBeNull();
    expect(node!.title).toBe("Users — Backend API");
    expect(node!.acceptanceCriteria).toEqual(["Users endpoint returns 200"]);
    expect(node!.tags).toEqual(["backend"]);
    expect(node!.status).toBe("backlog");
  });

  it("should preserve unresolved variables as-is", () => {
    const template: TaskTemplate = {
      name: "Partial",
      nodeDefinitions: [
        {
          type: "task",
          titleTemplate: "{{name}} — {{missing}}",
        },
      ],
    };

    const result = instantiateTemplate(store, template, { name: "Auth" });
    const node = store.getNodeById(result.nodesCreated[0]);
    expect(node!.title).toBe("Auth — {{missing}}");
  });

  // ── Multiple Nodes + Edges ────────────────────

  it("should create multiple nodes and edges between them", () => {
    const template: TaskTemplate = {
      name: "Full Stack",
      nodeDefinitions: [
        { type: "task", titleTemplate: "{{name}} — Backend" },
        { type: "task", titleTemplate: "{{name}} — Frontend" },
        { type: "subtask", titleTemplate: "{{name}} — Tests" },
      ],
      edgeDefinitions: [
        { fromIndex: 1, toIndex: 0, relationType: "depends_on" },
        { fromIndex: 2, toIndex: 0, relationType: "depends_on" },
      ],
    };

    const result = instantiateTemplate(store, template, { name: "Orders" });

    expect(result.nodesCreated).toHaveLength(3);
    expect(result.edgesCreated).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    // Verify edge was created
    const doc = store.toGraphDocument();
    const edge = doc.edges.find(
      (e) => e.from === result.nodesCreated[1] && e.to === result.nodesCreated[0],
    );
    expect(edge).toBeDefined();
    expect(edge!.relationType).toBe("depends_on");
  });

  // ── Parent Edges ──────────────────────────────

  it("should create parent/child edges when parentId is provided", () => {
    const epicNode = makeNode({ type: "epic", title: "Epic" });
    store.insertNode(epicNode);

    const template: TaskTemplate = {
      name: "Child Tasks",
      nodeDefinitions: [
        { type: "task", titleTemplate: "Task A" },
        { type: "task", titleTemplate: "Task B" },
      ],
    };

    const result = instantiateTemplate(store, template, {}, epicNode.id);

    expect(result.nodesCreated).toHaveLength(2);
    // 2 parent_of edges (one per node)
    expect(result.edgesCreated).toHaveLength(2);

    // Verify nodes have parentId
    const nodeA = store.getNodeById(result.nodesCreated[0]);
    expect(nodeA!.parentId).toBe(epicNode.id);

    // Verify parent_of edge exists
    const doc = store.toGraphDocument();
    const parentEdge = doc.edges.find(
      (e) => e.from === epicNode.id && e.to === result.nodesCreated[0] && e.relationType === "parent_of",
    );
    expect(parentEdge).toBeDefined();

    // Verify child_of edge exists
    const childEdge = doc.edges.find(
      (e) => e.from === result.nodesCreated[0] && e.to === epicNode.id && e.relationType === "child_of",
    );
    expect(childEdge).toBeDefined();
  });

  // ── xpSize + description substitution ─────────

  it("should apply xpSize and substitute description variables", () => {
    const template: TaskTemplate = {
      name: "Sized",
      nodeDefinitions: [
        {
          type: "task",
          titleTemplate: "{{feature}} task",
          description: "Implement {{feature}} module",
          xpSize: "M",
        },
      ],
    };

    const result = instantiateTemplate(store, template, { feature: "Auth" });
    const node = store.getNodeById(result.nodesCreated[0]);
    expect(node!.xpSize).toBe("M");
    expect(node!.description).toBe("Implement Auth module");
  });

  // ── listTemplates ─────────────────────────────

  it("should list templates stored as milestone nodes with templateDefinition metadata", () => {
    // Insert a milestone node with templateDefinition metadata
    const milestoneNode = makeNode({
      type: "milestone",
      title: "Feature Template",
      description: "Standard feature tasks",
      metadata: {
        templateDefinition: {
          nodeDefinitions: [
            { type: "task", titleTemplate: "{{name}} — API" },
          ],
        },
      },
    });
    store.insertNode(milestoneNode);

    // Insert a regular task node (should NOT appear)
    const taskNode = makeNode({ type: "task", title: "Regular Task" });
    store.insertNode(taskNode);

    const templates = listTemplates(store);
    expect(templates).toHaveLength(1);
    expect(templates[0].nodeId).toBe(milestoneNode.id);
    expect(templates[0].name).toBe("Feature Template");
    expect(templates[0].description).toBe("Standard feature tasks");
  });

  it("should return empty array when no templates exist", () => {
    const templates = listTemplates(store);
    expect(templates).toHaveLength(0);
  });

  // ── Edge error handling ───────────────────────

  it("should skip edges with invalid indices gracefully", () => {
    const template: TaskTemplate = {
      name: "Bad Edges",
      nodeDefinitions: [
        { type: "task", titleTemplate: "Only task" },
      ],
      edgeDefinitions: [
        { fromIndex: 0, toIndex: 5, relationType: "depends_on" }, // index 5 doesn't exist
      ],
    };

    const result = instantiateTemplate(store, template, {});
    expect(result.nodesCreated).toHaveLength(1);
    expect(result.edgesCreated).toHaveLength(0);
    expect(result.errors).toHaveLength(0); // skipped, not an error
  });
});
