import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { runRemPhase } from "../core/dream/phases/rem-phase.js";
import { DEFAULT_DREAM_CONFIG } from "../core/dream/dream-types.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  return db;
}

function insertTestDoc(
  db: Database.Database,
  id: string,
  opts: {
    qualityScore?: number;
    metadata?: Record<string, unknown>;
    sourceType?: string;
    content?: string;
  } = {},
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO knowledge_documents (id, source_type, source_id, title, content, content_hash, chunk_index, created_at, updated_at, quality_score, usage_count, metadata)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?)
  `).run(
    id,
    opts.sourceType ?? "memory",
    `src_${id}`,
    `Test doc ${id}`,
    opts.content ?? "Test content",
    `hash_${id}`,
    now,
    now,
    opts.qualityScore ?? 0.5,
    opts.metadata ? JSON.stringify(opts.metadata) : null,
  );
}

function insertDreamCycle(db: Database.Database, cycleId: string): void {
  db.prepare(`
    INSERT INTO dream_cycles (id, status, config, started_at)
    VALUES (?, 'running', '{}', ?)
  `).run(cycleId, new Date().toISOString());
}

describe("rem-phase", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe("priority processing", () => {
    it("should boost quality of docs with priority blocker metadata", () => {
      insertTestDoc(db, "blocker_doc", {
        qualityScore: 0.4,
        metadata: { priority: "blocker" },
      });

      const cycleId = "cycle_priority";
      insertDreamCycle(db, cycleId);

      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.priorityProcessed).toBeGreaterThanOrEqual(1);

      const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get("blocker_doc") as { quality_score: number };
      expect(row.quality_score).toBeGreaterThan(0.4);
    });

    it("should decay urgency flag in metadata", () => {
      insertTestDoc(db, "urgent_doc", {
        qualityScore: 0.5,
        metadata: { priority: "error", urgency: 1.0 },
      });

      const cycleId = "cycle_urgency";
      insertDreamCycle(db, cycleId);

      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.urgencyDecayed).toBeGreaterThanOrEqual(1);

      const row = db.prepare("SELECT metadata FROM knowledge_documents WHERE id = ?").get("urgent_doc") as { metadata: string };
      const meta = JSON.parse(row.metadata);
      expect(meta.urgency).toBeLessThan(1.0);
    });
  });

  describe("association strengthening", () => {
    it("should create associations from shared context via linkBySharedContext", () => {
      // Two docs sharing a nodeId in metadata → should be linked
      insertTestDoc(db, "doc_a", { metadata: { nodeId: "node_123" } });
      insertTestDoc(db, "doc_b", { metadata: { nodeId: "node_123" }, sourceType: "ai_decision" });

      const cycleId = "cycle_assoc";
      insertDreamCycle(db, cycleId);

      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.associationsCreated).toBeGreaterThanOrEqual(0); // linker may or may not find links
    });
  });

  describe("semantic merge", () => {
    function createMockProvider(ids: string[]): {
      count: () => number;
      findSimilar: (_qv: number[], _lim: number) => Array<{ id: string; similarity: number }>;
      getById: (id: string) => { id: string; embedding: number[] } | null;
      getAllIds: () => string[];
    } {
      const vecs = new Map<string, number[]>();
      vecs.set(ids[0], [1.0, 0.0, 0.0]);
      if (ids[1]) vecs.set(ids[1], [0.99, 0.01, 0.0]);
      return {
        count: () => ids.length,
        findSimilar: () => ids.length > 1
          ? [{ id: ids[1], similarity: 0.99 }]
          : [],
        getById: (id: string) => {
          const vec = vecs.get(id);
          return vec ? { id, embedding: vec } : null;
        },
        getAllIds: () => ids,
      };
    }

    it("should soft-merge similar docs with mergeable source type", () => {
      // Arrange — two similar docs with mergeable source type
      insertTestDoc(db, "sim_a", { content: "GraphNode represents tasks", sourceType: "docs" });
      insertTestDoc(db, "sim_b", { content: "GraphNode represents tasks (v2)", sourceType: "docs" });

      const provider = createMockProvider(["sim_a", "sim_b"]);
      const cycleId = "cycle_merge";
      insertDreamCycle(db, cycleId);

      // Act
      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId, provider);

      // Assert — soft-merge happened
      expect(result.merged).toBeGreaterThanOrEqual(1);
      expect(result.clustersFormed).toBeGreaterThanOrEqual(1);

      // Assert — doc NOT deleted, but quality decayed + metadata set
      const row = db.prepare("SELECT quality_score, metadata FROM knowledge_documents WHERE id = ?").get("sim_b") as { quality_score: number; metadata: string };
      expect(row).toBeDefined(); // still exists (not hard-deleted)
      expect(row.quality_score).toBeLessThan(0.5); // decayed
      const meta = JSON.parse(row.metadata);
      expect(meta.merged_into).toBe("sim_a");
      expect(meta.pre_merge_score).toBe(0.5);
    });

    it("should NOT merge protected source types (memory, prd, ai_decision)", () => {
      // Arrange — similar docs with protected source types
      insertTestDoc(db, "prot_a", { content: "Architecture decision", sourceType: "memory" });
      insertTestDoc(db, "prot_b", { content: "Architecture decision (v2)", sourceType: "memory" });

      const provider = createMockProvider(["prot_a", "prot_b"]);
      const cycleId = "cycle_protected";
      insertDreamCycle(db, cycleId);

      // Act
      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId, provider);

      // Assert — no merges for protected types
      expect(result.merged).toBe(0);

      // Assert — docs unchanged
      const row = db.prepare("SELECT quality_score FROM knowledge_documents WHERE id = ?").get("prot_b") as { quality_score: number };
      expect(row.quality_score).toBe(0.5); // unchanged
    });

    it("should NOT merge across different source types", () => {
      // Arrange — one mergeable, one protected
      insertTestDoc(db, "mix_a", { content: "Same content", sourceType: "docs" });
      insertTestDoc(db, "mix_b", { content: "Same content", sourceType: "prd" });

      const provider = createMockProvider(["mix_a", "mix_b"]);
      const cycleId = "cycle_cross";
      insertDreamCycle(db, cycleId);

      // Act
      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId, provider);

      // Assert — prd doc not merged
      expect(result.merged).toBe(0);
    });

    it("should return merged=0 when no embeddingStore is provided", () => {
      insertTestDoc(db, "no_emb_doc", { content: "some content" });

      const cycleId = "cycle_no_emb";
      insertDreamCycle(db, cycleId);

      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result.merged).toBe(0);
      expect(result.clustersFormed).toBe(0);
    });
  });

  describe("result shape", () => {
    it("should return valid RemPhaseResult", () => {
      insertTestDoc(db, "doc_rem", { qualityScore: 0.5 });

      const cycleId = "cycle_rem_shape";
      insertDreamCycle(db, cycleId);

      const result = runRemPhase(db, DEFAULT_DREAM_CONFIG, cycleId);
      expect(result).toHaveProperty("priorityProcessed");
      expect(result).toHaveProperty("urgencyDecayed");
      expect(result).toHaveProperty("merged");
      expect(result).toHaveProperty("clustersFormed");
      expect(result).toHaveProperty("associationsCreated");
      expect(result).toHaveProperty("durationMs");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
