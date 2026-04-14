import { describe, it, expect } from "vitest";
import { parseFacetedSearch, applyFacetedFilter } from "../web/dashboard/src/lib/faceted-search.js";
import type { FacetedQuery } from "../web/dashboard/src/lib/faceted-search.js";

describe("parseFacetedSearch", () => {
  it("should parse status:done facet", () => {
    const result = parseFacetedSearch("status:done");
    expect(result.facets.status).toBe("done");
    expect(result.freeText).toBe("");
  });

  it("should parse priority:1 facet", () => {
    const result = parseFacetedSearch("priority:1");
    expect(result.facets.priority).toBe("1");
    expect(result.freeText).toBe("");
  });

  it("should parse sprint facet", () => {
    const result = parseFacetedSearch("sprint:v9.2");
    expect(result.facets.sprint).toBe("v9.2");
    expect(result.freeText).toBe("");
  });

  it("should parse type facet", () => {
    const result = parseFacetedSearch("type:task");
    expect(result.facets.type).toBe("task");
    expect(result.freeText).toBe("");
  });

  it("should parse combined facets", () => {
    const result = parseFacetedSearch("status:backlog sprint:v9.2");
    expect(result.facets.status).toBe("backlog");
    expect(result.facets.sprint).toBe("v9.2");
    expect(result.freeText).toBe("");
  });

  it("should separate free text from facets", () => {
    const result = parseFacetedSearch("status:done auth login");
    expect(result.facets.status).toBe("done");
    expect(result.freeText).toBe("auth login");
  });

  it("should handle pure free text (no facets)", () => {
    const result = parseFacetedSearch("authentication bug");
    expect(result.facets).toEqual({});
    expect(result.freeText).toBe("authentication bug");
  });

  it("should handle empty string", () => {
    const result = parseFacetedSearch("");
    expect(result.facets).toEqual({});
    expect(result.freeText).toBe("");
  });

  it("should treat invalid facets as free text", () => {
    const result = parseFacetedSearch("invalidfacet:value");
    expect(result.facets).toEqual({});
    expect(result.freeText).toBe("invalidfacet:value");
  });
});

describe("applyFacetedFilter", () => {
  const nodes = [
    { title: "Auth login", type: "task", status: "done", priority: 1, sprint: "v9.2" },
    { title: "Auth logout", type: "task", status: "backlog", priority: 2, sprint: "v9.2" },
    { title: "DB migration", type: "subtask", status: "done", priority: 3, sprint: "v9.1" },
    { title: "API design", type: "task", status: "in_progress", priority: 1, sprint: null },
  ];

  it("should filter by status:done", () => {
    const query: FacetedQuery = { freeText: "", facets: { status: "done" } };
    const result = applyFacetedFilter(nodes, query);
    expect(result).toHaveLength(2);
    expect(result.every((n) => n.status === "done")).toBe(true);
  });

  it("should filter by priority:1", () => {
    const query: FacetedQuery = { freeText: "", facets: { priority: "1" } };
    const result = applyFacetedFilter(nodes, query);
    expect(result).toHaveLength(2);
    expect(result.every((n) => n.priority === 1)).toBe(true);
  });

  it("should filter by combined status + sprint", () => {
    const query: FacetedQuery = { freeText: "", facets: { status: "done", sprint: "v9.2" } };
    const result = applyFacetedFilter(nodes, query);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Auth login");
  });

  it("should apply free text after facets", () => {
    const query: FacetedQuery = { freeText: "auth", facets: { status: "done" } };
    const result = applyFacetedFilter(nodes, query);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Auth login");
  });

  it("should return all nodes for empty query", () => {
    const query: FacetedQuery = { freeText: "", facets: {} };
    const result = applyFacetedFilter(nodes, query);
    expect(result).toHaveLength(4);
  });

  it("should handle type facet", () => {
    const query: FacetedQuery = { freeText: "", facets: { type: "subtask" } };
    const result = applyFacetedFilter(nodes, query);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("DB migration");
  });
});
