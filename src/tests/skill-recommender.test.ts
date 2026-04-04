import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { recommendSkills, recommendBuiltInSkills, type SkillInfo } from "../core/insights/skill-recommender.js";
import { getSkillByName } from "../core/skills/built-in-skills.js";
import { makeNode } from "./helpers/factories.js";

const MOCK_SKILLS: SkillInfo[] = [
  { name: "comprehensive-testing-reference", description: "Generate tests", category: "testing", filePath: "/skills/test" },
  { name: "code-reviewer", description: "Review code", category: "review", filePath: "/skills/review" },
  { name: "breakdown-feature-prd", description: "Decompose feature PRD", category: "planning", filePath: "/skills/flow" },
  { name: "create-prd-chat-mode", description: "Create PRD", category: "design", filePath: "/skills/prd" },
];

describe("recommendSkills (filesystem-based)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Skills Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should recommend test generator for in-progress tasks without tests", () => {
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "in_progress" }));

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    const testRec = recs.find((r) => r.skill === "comprehensive-testing-reference");
    expect(testRec).toBeDefined();
    expect(testRec!.phase).toBe("IMPLEMENT");
  });

  it("should recommend replanning when many tasks are blocked", () => {
    for (let i = 0; i < 5; i++) {
      store.insertNode(makeNode({ status: "blocked", blocked: true }));
    }

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    const planRec = recs.find((r) => r.skill === "breakdown-feature-prd" && r.phase === "ANALYZE");
    expect(planRec).toBeDefined();
  });

  it("should recommend PRD tool when many tasks lack AC", () => {
    for (let i = 0; i < 7; i++) {
      store.insertNode(makeNode({ status: "backlog" }));
    }

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    const prdRec = recs.find((r) => r.skill === "create-prd-chat-mode");
    expect(prdRec).toBeDefined();
  });

  it("should return empty recommendations for clean graph", () => {
    store.insertNode(makeNode({
      status: "done",
      acceptanceCriteria: ["Tested"],
      tags: ["tested"],
    }));

    const doc = store.toGraphDocument();
    const recs = recommendSkills(doc, MOCK_SKILLS);

    expect(recs.length).toBe(0);
  });
});

describe("recommendBuiltInSkills", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("BuiltIn Skills Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should recommend create-prd-chat-mode for empty graph in ANALYZE phase", () => {
    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "ANALYZE");

    const prdRec = recs.find((r) => r.skill === "create-prd-chat-mode");
    expect(prdRec).toBeDefined();
    expect(prdRec!.phase).toBe("ANALYZE");
  });

  it("should recommend comprehensive-testing-reference for in_progress without tested tag in IMPLEMENT", () => {
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "in_progress" }));

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "IMPLEMENT");

    const testRec = recs.find((r) => r.skill === "comprehensive-testing-reference");
    expect(testRec).toBeDefined();
    expect(testRec!.phase).toBe("IMPLEMENT");
  });

  it("should recommend subagent-driven-development for multiple in_progress tasks in IMPLEMENT", () => {
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "in_progress" }));

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "IMPLEMENT");

    const subRec = recs.find((r) => r.skill === "subagent-driven-development");
    expect(subRec).toBeDefined();
  });

  it("should recommend deployment-engineer when all tasks done in DEPLOY", () => {
    store.insertNode(makeNode({ status: "done" }));
    store.insertNode(makeNode({ status: "done" }));

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "DEPLOY");

    const deployRec = recs.find((r) => r.skill === "deployment-engineer");
    expect(deployRec).toBeDefined();
    expect(deployRec!.phase).toBe("DEPLOY");
  });

  it("should recommend delivery-checklist in HANDOFF", () => {
    store.insertNode(makeNode({ status: "done" }));

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "HANDOFF");

    const handoffRec = recs.find((r) => r.skill === "delivery-checklist");
    expect(handoffRec).toBeDefined();
    expect(handoffRec!.phase).toBe("HANDOFF");
  });

  it("should recommend feedback-collector in LISTENING", () => {
    store.insertNode(makeNode({ status: "done" }));

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "LISTENING");

    const listenRec = recs.find((r) => r.skill === "feedback-collector");
    expect(listenRec).toBeDefined();
    expect(listenRec!.phase).toBe("LISTENING");
  });

  it("should never return more than 5 recommendations", () => {
    for (let i = 0; i < 10; i++) {
      store.insertNode(makeNode({ status: "in_progress" }));
    }

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "IMPLEMENT");

    expect(recs.length).toBeLessThanOrEqual(5);
  });

  it("should only recommend skills that exist in built-in registry", () => {
    store.insertNode(makeNode({ status: "in_progress" }));
    store.insertNode(makeNode({ status: "backlog" }));

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "IMPLEMENT");

    for (const rec of recs) {
      expect(getSkillByName(rec.skill)).toBeDefined();
    }
  });

  it("should recommend business-analyst when tasks lack AC in ANALYZE", () => {
    for (let i = 0; i < 6; i++) {
      store.insertNode(makeNode({ type: "epic", status: "backlog" }));
    }

    const doc = store.toGraphDocument();
    const recs = recommendBuiltInSkills(doc, "ANALYZE");

    const baRec = recs.find((r) => r.skill === "business-analyst");
    expect(baRec).toBeDefined();
  });
});
