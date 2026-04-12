import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { SpecStore } from "../core/spec-evolution/spec-store.js";

describe("Spec Evolution (migration v33 + SpecStore)", () => {
  let db: Database.Database;
  let store: SpecStore;
  const projectId = "test-project";

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    store = new SpecStore(db);
  });

  describe("migration v33", () => {
    it("should create spec_documents table", () => {
      const info = db.prepare("PRAGMA table_info(spec_documents)").all() as Array<{ name: string }>;
      const columns = info.map((c) => c.name);
      expect(columns).toContain("id");
      expect(columns).toContain("project_id");
      expect(columns).toContain("name");
      expect(columns).toContain("template_name");
      expect(columns).toContain("content_hash");
      expect(columns).toContain("version");
      expect(columns).toContain("status");
    });

    it("should create spec_document_versions table", () => {
      const info = db.prepare("PRAGMA table_info(spec_document_versions)").all() as Array<{ name: string }>;
      const columns = info.map((c) => c.name);
      expect(columns).toContain("id");
      expect(columns).toContain("spec_id");
      expect(columns).toContain("version");
      expect(columns).toContain("content");
      expect(columns).toContain("diff_summary");
    });

    it("should create spec_node_links table", () => {
      const info = db.prepare("PRAGMA table_info(spec_node_links)").all() as Array<{ name: string }>;
      const columns = info.map((c) => c.name);
      expect(columns).toContain("spec_id");
      expect(columns).toContain("node_id");
      expect(columns).toContain("section_title");
      expect(columns).toContain("link_type");
    });
  });

  describe("SpecStore CRUD", () => {
    it("should register a spec document", () => {
      // Act
      const spec = store.register({
        projectId,
        name: "my-spec",
        templateName: "prd-template",
        content: "# PRD\n## Vision\nTest vision",
      });

      // Assert
      expect(spec.id).toBeDefined();
      expect(spec.version).toBe(1);
      expect(spec.status).toBe("draft");
    });

    it("should archive previous version when updated", () => {
      // Arrange
      const spec = store.register({
        projectId,
        name: "versioned-spec",
        templateName: "prd-template",
        content: "# V1 content",
      });

      // Act
      store.update(spec.id, "# V2 content updated", "Added user stories section");

      // Assert
      const updated = store.get(spec.id);
      expect(updated?.version).toBe(2);

      const history = store.getHistory(spec.id);
      expect(history).toHaveLength(1); // v1 archived
      expect(history[0].version).toBe(1);
      expect(history[0].diff_summary).toBe("Initial version");
    });

    it("should return history ordered by version descending", () => {
      // Arrange
      const spec = store.register({ projectId, name: "multi-version", templateName: "prd", content: "v1" });
      store.update(spec.id, "v2 content", "Added constraints");
      store.update(spec.id, "v3 content", "Added risks");

      // Act
      const history = store.getHistory(spec.id);

      // Assert
      expect(history).toHaveLength(2); // v1 and v2 archived (v3 is current)
      expect(history[0].version).toBe(2);
      expect(history[1].version).toBe(1);
    });
  });

  describe("SpecStore node links", () => {
    it("should link a spec to a node", () => {
      // Arrange
      const spec = store.register({ projectId, name: "linked-spec", templateName: "prd", content: "test" });

      // Act
      store.linkNode(spec.id, "node-123", "Vision", "derived_from");

      // Assert
      const links = store.getLinksForSpec(spec.id);
      expect(links).toHaveLength(1);
      expect(links[0].node_id).toBe("node-123");
      expect(links[0].section_title).toBe("Vision");
      expect(links[0].link_type).toBe("derived_from");
    });

    it("should reverse lookup specs by node_id", () => {
      // Arrange
      const spec1 = store.register({ projectId, name: "spec-a", templateName: "prd", content: "a" });
      const spec2 = store.register({ projectId, name: "spec-b", templateName: "arch", content: "b" });
      store.linkNode(spec1.id, "shared-node", "Vision", "derived_from");
      store.linkNode(spec2.id, "shared-node", "Components", "implements");

      // Act
      const links = store.getLinksForNode("shared-node");

      // Assert
      expect(links).toHaveLength(2);
    });

    it("should remove links when spec is removed", () => {
      // Arrange
      const spec = store.register({ projectId, name: "removable", templateName: "prd", content: "x" });
      store.linkNode(spec.id, "node-1", "Section", "validates");

      // Act
      store.remove(spec.id);

      // Assert
      expect(store.get(spec.id)).toBeUndefined();
      expect(store.getLinksForSpec(spec.id)).toHaveLength(0);
    });
  });
});
