import { describe, it, expect } from "vitest";
import {
  Wave12OverviewSchema,
  Wave12ProblemSchema,
  Wave12DocumentationSchema,
} from "../schemas/wave-12-prd-schema.js";

describe("Wave-12 PRD Schema", () => {
  describe("Wave12OverviewSchema", () => {
    it("should validate correct overview", () => {
      const overview = {
        title: "Visao Geral",
        rationale:
          "Criar um modulo de sandbox no mcp-graph para validar build/test localmente em ambiente isolado",
        isolationMechanisms: [
          "Docker container isolation",
          "Process isolation fallback",
          "Ephemeral workspace per build",
        ],
        targetFlow: "Reduce push-fail-fix loops by validating locally with CI parity",
        integrationPoints: [
          "finish_task",
          "qualityGates",
          "constitution",
          "harness_remediate",
        ],
      };

      const result = Wave12OverviewSchema.parse(overview);
      expect(result.title).toBe("Visao Geral");
      expect(result.isolationMechanisms).toHaveLength(3);
      expect(result.integrationPoints).toContain("finish_task");
    });

    it("should fail on missing required fields", () => {
      const incomplete = {
        title: "Visao Geral",
        // missing rationale, isolationMechanisms, etc
      };

      expect(() => Wave12OverviewSchema.parse(incomplete)).toThrow();
    });

    it("should require at least one isolation mechanism and integration point", () => {
      const overview = {
        title: "Visao Geral",
        rationale: "Test rationale",
        isolationMechanisms: [],
        targetFlow: "Test flow description",
        integrationPoints: [],
      };

      expect(() => Wave12OverviewSchema.parse(overview)).toThrow();
    });
  });

  describe("Wave12ProblemSchema", () => {
    it("should validate correct problem statement", () => {
      const problem = {
        title: "Problema",
        currentState:
          "Fluxo permite falhas previsiveis (deps ausentes, mismatch ambiente, YAML invalido)",
        consequences: [
          "Aumento de tempo de feedback",
          "Multiplos commits de correcao",
          "Aumento carga operacional em deploy",
          "Ruido em pipeline e revisao",
        ],
        costOfInaction:
          "Ciclos longos de integração levam a retrabalho e aumento de WIP",
        constraints: [
          "Nao substituir pipeline de CI remoto",
          "MVP focus em Maven/Java initially",
          "Local-first, zero credencial persistence",
        ],
      };

      const result = Wave12ProblemSchema.parse(problem);
      expect(result.title).toBe("Problema");
      expect(result.consequences).toHaveLength(4);
      expect(result.constraints).toContain(
        "Nao substituir pipeline de CI remoto"
      );
    });

    it("should fail on missing required fields", () => {
      const incomplete = {
        title: "Problema",
        // missing currentState, consequences, etc
      };

      expect(() => Wave12ProblemSchema.parse(incomplete)).toThrow();
    });

    it("should require at least one consequence", () => {
      const problem = {
        title: "Problema",
        currentState: "Test state",
        consequences: [],
        costOfInaction: "Test cost",
        constraints: [],
      };

      expect(() => Wave12ProblemSchema.parse(problem)).toThrow();
    });

    it("should validate string constraints", () => {
      const problem = {
        title: "Problema",
        currentState: "Current problematic state description",
        consequences: ["consequence 1"],
        costOfInaction: "Cost of not addressing this problem",
        constraints: ["constraint 1", "constraint 2"],
      };

      const result = Wave12ProblemSchema.parse(problem);
      expect(result.constraints).toHaveLength(2);
    });
  });

  describe("Wave12DocumentationSchema", () => {
    it("should consolidate overview and problem into complete documentation", () => {
      const doc = {
        waveId: "wave-12",
        waveTitle: "Sandbox Build (Local CI/CD Isolation)",
        overview: {
          title: "Visao Geral",
          rationale:
            "Criar um modulo de sandbox no mcp-graph para validar build/test localmente",
          isolationMechanisms: ["Docker", "Podman", "Process"],
          targetFlow: "Reduce loops",
          integrationPoints: ["finish_task", "qualityGates"],
        },
        problem: {
          title: "Problema",
          currentState: "Fluxo permite falhas previsiveis",
          consequences: ["Aumento de tempo de feedback"],
          costOfInaction: "Ciclos longos",
          constraints: ["Nao substituir CI remoto"],
        },
        objectives: [
          "Garantir validacao local obrigatoria",
          "Reproduzir ambiente de CI localmente",
        ],
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-1",
      };

      const result = Wave12DocumentationSchema.parse(doc);
      expect(result.waveId).toBe("wave-12");
      expect(result.overview.rationale).toBeDefined();
      expect(result.problem.consequences).toHaveLength(1);
      expect(result.objectives).toHaveLength(2);
    });

    it("should be ready for graph persistence with nodeId reference", () => {
      const doc = {
        waveId: "wave-12",
        waveTitle: "Sandbox Build",
        overview: {
          title: "Visao Geral",
          rationale: "Sandbox isolation rationale description",
          isolationMechanisms: ["Docker"],
          targetFlow: "Reduce push-fail-fix cycles effectively",
          integrationPoints: ["finish_task"],
        },
        problem: {
          title: "Problema",
          currentState: "Current problematic state description",
          consequences: ["consequence"],
          costOfInaction: "Cost of not fixing this problem",
          constraints: [],
        },
        objectives: [],
        graphNodeId: "node_25b5854e13f0", // reference to existing epic node
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-1",
      };

      const result = Wave12DocumentationSchema.parse(doc);
      expect(result.graphNodeId).toBe("node_25b5854e13f0");
    });

    it("should preserve metadata for RAG indexing", () => {
      const doc = {
        waveId: "wave-12",
        waveTitle: "Sandbox Build",
        overview: {
          title: "Visao Geral",
          rationale: "Sandbox isolation rationale description",
          isolationMechanisms: ["Docker"],
          targetFlow: "Reduce push-fail-fix cycles effectively",
          integrationPoints: ["finish_task"],
        },
        problem: {
          title: "Problema",
          currentState: "Current problematic state description",
          consequences: ["consequence 1"],
          costOfInaction: "Cost of not fixing this problem",
          constraints: [],
        },
        objectives: [],
        metadata: {
          phase: "ANALYZE",
          tags: ["sandbox", "ci-cd", "isolation"],
          isConsolidated: true,
        },
        createdAt: new Date().toISOString(),
        createdBy: "agent-wave12-1",
      };

      const result = Wave12DocumentationSchema.parse(doc);
      expect(result.metadata?.phase).toBe("ANALYZE");
      expect(result.metadata?.tags).toContain("sandbox");
    });
  });
});
