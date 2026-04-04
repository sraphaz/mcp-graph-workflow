import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { validateAcQuality } from "../core/analyzer/ac-validator.js";
import { makeNode } from "./helpers/factories.js";

describe("validateAcQuality", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("AC Validator Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty report when no nodes have AC", () => {
    store.insertNode(makeNode({ type: "task", title: "No AC" }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes).toHaveLength(0);
    expect(report.overallScore).toBe(0);
  });

  it("should validate a node with good GWT AC", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Login feature",
      acceptanceCriteria: [
        "Given a registered user\nWhen they submit valid credentials\nThen they should be redirected to dashboard",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes).toHaveLength(1);
    expect(report.nodes[0].score).toBeGreaterThan(0);
    expect(report.nodes[0].parsedAcs[0].format).toBe("gwt");
  });

  it("should detect vague terms", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Vague task",
      acceptanceCriteria: ["The page should load fast and be easy to use"],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].vagueTerms.length).toBeGreaterThan(0);
  });

  it("should run INVEST checks", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Well-defined task",
      acceptanceCriteria: [
        "O sistema deve retornar status 200 com JSON contendo o campo 'id'",
        "O sistema deve rejeitar requests sem token de autenticação com status 401",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].investChecks.length).toBe(6); // I, N, V, E, S, T
    const criteriaNames = report.nodes[0].investChecks.map((c) => c.criterion);
    expect(criteriaNames).toContain("Independent");
    expect(criteriaNames).toContain("Testable");
  });

  it("should filter by nodeId", () => {
    const target = makeNode({
      type: "task",
      title: "Target",
      acceptanceCriteria: ["Must return data"],
    });
    store.insertNode(target);
    store.insertNode(makeNode({
      type: "task",
      title: "Other",
      acceptanceCriteria: ["Other AC"],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc, target.id);

    expect(report.nodes).toHaveLength(1);
    expect(report.nodes[0].nodeId).toBe(target.id);
  });

  it("should score measurable ACs higher than vague ACs", () => {
    const measurableNode = makeNode({
      id: "measurable",
      type: "task",
      title: "Measurable task",
      acceptanceCriteria: [
        "O sistema deve responder em menos de 200ms",
        "O endpoint deve retornar status 200 com JSON válido",
      ],
    });
    const vagueNode = makeNode({
      id: "vague",
      type: "task",
      title: "Vague task",
      acceptanceCriteria: [
        "O sistema deve ser rápido",
        "O endpoint deve retornar dados",
      ],
    });
    store.insertNode(measurableNode);
    store.insertNode(vagueNode);

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    const measurableReport = report.nodes.find((n) => n.nodeId === "measurable")!;
    const vagueReport = report.nodes.find((n) => n.nodeId === "vague")!;

    expect(measurableReport.score).toBeGreaterThan(vagueReport.score);
  });

  it("should not exceed score of 100 with measurability bonus", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Perfect task",
      acceptanceCriteria: [
        "O sistema deve retornar status 200 em menos de 100ms",
        "O sistema deve salvar o registro no banco com campo 'createdAt' preenchido",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].score).toBeLessThanOrEqual(100);
  });

  it("should suggest reformulations for vague ACs", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Vague ACs",
      acceptanceCriteria: [
        "O sistema deve ser rápido",
        "A interface deve ser fácil de usar",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].suggestions).toBeDefined();
    expect(report.nodes[0].suggestions!.length).toBeGreaterThan(0);
  });

  it("should not suggest reformulations for concrete ACs", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Concrete ACs",
      acceptanceCriteria: [
        "O sistema deve retornar status 200 em menos de 100ms",
        "O endpoint deve salvar o registro com campo 'id' preenchido",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    expect(report.nodes[0].suggestions ?? []).toHaveLength(0);
  });

  it("should flag implementation details in AC", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Implementation-heavy AC",
      acceptanceCriteria: [
        "Execute SQL query SELECT * FROM users WHERE id = :id",
      ],
    }));

    const doc = store.toGraphDocument();
    const report = validateAcQuality(doc);

    const negotiableCheck = report.nodes[0].investChecks.find((c) => c.criterion === "Negotiable");
    expect(negotiableCheck!.passed).toBe(false);
  });
});
