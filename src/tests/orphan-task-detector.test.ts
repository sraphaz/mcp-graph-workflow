/**
 * TDD tests for OrphanTaskDetector — detects tasks stuck in backlog/ready
 * whose implementation already exists on disk.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { detectOrphanTasks } from "../core/analyzer/orphan-task-detector.js";
import { makeTask } from "./helpers/factories.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function createStore(): SqliteStore {
  const store = SqliteStore.open(":memory:");
  store.initProject("test-project");
  return store;
}

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "orphan-test-"));
}

describe("OrphanTaskDetector", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = createStore();
  });

  // ── sourceRef file existence ─────────────────────────

  describe("source_file existence", () => {
    it("should detect orphan when sourceRef file exists on disk", () => {
      const tmpDir = createTempDir();
      const filePath = join(tmpDir, "src/core/feature.ts");
      mkdirSync(join(tmpDir, "src/core"), { recursive: true });
      writeFileSync(filePath, "export function feature() { return true; }");

      store.insertNode(makeTask({
        id: "task-1",
        title: "Implement feature module",
        sourceRef: { file: "src/core/feature.ts" },
      }));

      const orphans = detectOrphanTasks(store, tmpDir);

      expect(orphans).toHaveLength(1);
      expect(orphans[0].nodeId).toBe("task-1");
      expect(orphans[0].confidence).toBeCloseTo(0.9);
      expect(orphans[0].evidence.some((e) => e.type === "file_exists")).toBe(true);
      expect(orphans[0].suggestedAction).toBe("mark_done");
    });

    it("should NOT detect orphan when sourceRef file does not exist", () => {
      const tmpDir = createTempDir();

      store.insertNode(makeTask({
        id: "task-1",
        title: "Implement missing feature",
        sourceRef: { file: "src/core/nonexistent.ts" },
      }));

      const orphans = detectOrphanTasks(store, tmpDir);
      expect(orphans).toHaveLength(0);
    });
  });

  // ── testFiles existence ──────────────────────────────

  describe("testFiles existence", () => {
    it("should detect orphan when testFiles exist on disk", () => {
      const tmpDir = createTempDir();
      const testPath = join(tmpDir, "src/tests/feature.test.ts");
      mkdirSync(join(tmpDir, "src/tests"), { recursive: true });
      writeFileSync(testPath, "describe('feature', () => {});");

      store.insertNode(makeTask({
        id: "task-2",
        title: "Add tests for feature",
        testFiles: ["src/tests/feature.test.ts"],
      }));

      const orphans = detectOrphanTasks(store, tmpDir);

      expect(orphans).toHaveLength(1);
      expect(orphans[0].nodeId).toBe("task-2");
      expect(orphans[0].confidence).toBeCloseTo(0.85);
      expect(orphans[0].evidence.some((e) => e.type === "test_exists")).toBe(true);
    });
  });

  // ── combined evidence ────────────────────────────────

  describe("combined evidence", () => {
    it("should use highest confidence when multiple evidence types match", () => {
      const tmpDir = createTempDir();
      mkdirSync(join(tmpDir, "src/core"), { recursive: true });
      mkdirSync(join(tmpDir, "src/tests"), { recursive: true });
      writeFileSync(join(tmpDir, "src/core/widget.ts"), "export class Widget {}");
      writeFileSync(join(tmpDir, "src/tests/widget.test.ts"), "describe('Widget', () => {});");

      store.insertNode(makeTask({
        id: "task-3",
        title: "Build widget component",
        sourceRef: { file: "src/core/widget.ts" },
        testFiles: ["src/tests/widget.test.ts"],
      }));

      const orphans = detectOrphanTasks(store, tmpDir);

      expect(orphans).toHaveLength(1);
      expect(orphans[0].confidence).toBeCloseTo(0.9); // highest wins
      expect(orphans[0].evidence).toHaveLength(2);
    });
  });

  // ── filters ──────────────────────────────────────────

  describe("filters", () => {
    it("should only check tasks in backlog or ready status", () => {
      const tmpDir = createTempDir();
      mkdirSync(join(tmpDir, "src/core"), { recursive: true });
      writeFileSync(join(tmpDir, "src/core/done-feature.ts"), "export const done = true;");

      // Task already done — should NOT be an orphan candidate
      store.insertNode(makeTask({
        id: "task-done",
        title: "Already done task",
        status: "done",
        sourceRef: { file: "src/core/done-feature.ts" },
      }));

      // Task in_progress — should NOT be an orphan candidate
      store.insertNode(makeTask({
        id: "task-ip",
        title: "In progress task",
        status: "in_progress",
        sourceRef: { file: "src/core/done-feature.ts" },
      }));

      const orphans = detectOrphanTasks(store, tmpDir);
      expect(orphans).toHaveLength(0);
    });

    it("should return empty array when no tasks exist", () => {
      const tmpDir = createTempDir();
      const orphans = detectOrphanTasks(store, tmpDir);
      expect(orphans).toHaveLength(0);
    });
  });
});
