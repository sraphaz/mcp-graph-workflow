import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { SpecStore } from "../core/spec-evolution/spec-store.js";
import {
  handleSpecSyncSync,
  handleSpecSyncStatus,
  handleSpecSyncHistory,
  handleSpecSyncLink,
} from "../mcp/tools/spec-sync.js";

describe("Spec sync MCP tool handlers", () => {
  let db: Database.Database;
  let specStore: SpecStore;
  const projectId = "test-project";

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    specStore = new SpecStore(db);
  });

  describe("handleSpecSyncSync", () => {
    it("should sync spec and return change summary", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "sync-spec", templateName: "prd", content: "# V1" });

      // Act
      const result = handleSpecSyncSync(specStore, { specId: spec.id, content: "# V2 updated" });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.changed).toBe(true);
      expect(result.newVersion).toBe(2);
    });

    it("should report no changes when content is identical", () => {
      const spec = specStore.register({ projectId, name: "same-spec", templateName: "prd", content: "# Same" });
      const result = handleSpecSyncSync(specStore, { specId: spec.id, content: "# Same" });

      expect(result.ok).toBe(true);
      expect(result.changed).toBe(false);
    });
  });

  describe("handleSpecSyncStatus", () => {
    it("should return in_sync when spec exists and no linked nodes changed", () => {
      const spec = specStore.register({ projectId, name: "status-spec", templateName: "prd", content: "test" });
      const result = handleSpecSyncStatus(specStore, { specId: spec.id });

      expect(result.ok).toBe(true);
      expect(result.status).toBe("in_sync");
      expect(result.version).toBe(1);
    });

    it("should return not found for invalid specId", () => {
      const result = handleSpecSyncStatus(specStore, { specId: "nonexistent" });
      expect(result.ok).toBe(false);
    });
  });

  describe("handleSpecSyncHistory", () => {
    it("should return version history", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "history-spec", templateName: "prd", content: "v1" });
      specStore.update(spec.id, "v2 content", "Added section");
      specStore.update(spec.id, "v3 content", "Added risks");

      // Act
      const result = handleSpecSyncHistory(specStore, { specId: spec.id });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.versions).toHaveLength(2); // v1 and v2 archived
      expect(result.currentVersion).toBe(3);
    });
  });

  describe("handleSpecSyncLink", () => {
    it("should create a bidirectional link", () => {
      // Arrange
      const spec = specStore.register({ projectId, name: "link-spec", templateName: "prd", content: "test" });

      // Act
      const result = handleSpecSyncLink(specStore, {
        specId: spec.id,
        nodeId: "task-123",
        sectionTitle: "Vision",
        linkType: "implements",
      });

      // Assert
      expect(result.ok).toBe(true);
      expect(result.linked).toBe(true);

      const links = specStore.getLinksForSpec(spec.id);
      expect(links).toHaveLength(1);
      expect(links[0].link_type).toBe("implements");
    });
  });
});
