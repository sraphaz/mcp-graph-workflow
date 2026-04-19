/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../core/store/migrations.js";
import { PluginStore } from "../core/plugins/plugin-store.js";

describe("Plugin persistence (migration v32 + PluginStore)", () => {
  let db: Database.Database;
  let store: PluginStore;
  const projectId = "test-project";

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    // Migration v49 adds FK constraint on plugins.project_id → projects.id
    db.prepare(
      `INSERT OR IGNORE INTO projects (id, name, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    ).run(projectId, "Test Project");
    db.prepare(
      `INSERT OR IGNORE INTO projects (id, name, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    ).run("project-a", "Project A");
    db.prepare(
      `INSERT OR IGNORE INTO projects (id, name, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))`
    ).run("project-b", "Project B");
    store = new PluginStore(db);
  });

  describe("migration v32", () => {
    it("should create plugins table with correct columns", () => {
      // Arrange & Act
      const info = db.prepare("PRAGMA table_info(plugins)").all() as Array<{ name: string; type: string }>;
      const columns = info.map((col) => col.name);

      // Assert
      expect(columns).toContain("name");
      expect(columns).toContain("project_id");
      expect(columns).toContain("version");
      expect(columns).toContain("path");
      expect(columns).toContain("enabled");
      expect(columns).toContain("config");
      expect(columns).toContain("installed_at");
      expect(columns).toContain("updated_at");
    });

    it("should create index on project_id", () => {
      // Arrange & Act
      const indexes = db.prepare("PRAGMA index_list(plugins)").all() as Array<{ name: string }>;
      const indexNames = indexes.map((idx) => idx.name);

      // Assert
      expect(indexNames.some((n) => n.includes("plugins_project"))).toBe(true);
    });
  });

  describe("PluginStore CRUD", () => {
    it("should install a plugin", () => {
      // Arrange & Act
      store.install({
        projectId,
        name: "test-plugin",
        version: "1.0.0",
        path: "/plugins/test-plugin",
        config: { debug: true },
      });

      // Assert
      const plugins = store.list(projectId);
      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe("test-plugin");
      expect(plugins[0].version).toBe("1.0.0");
      expect(plugins[0].enabled).toBe(1);
    });

    it("should list only plugins for the active project", () => {
      // Arrange
      store.install({ projectId: "project-a", name: "plugin-a", version: "1.0.0", path: "/a" });
      store.install({ projectId: "project-b", name: "plugin-b", version: "1.0.0", path: "/b" });

      // Act
      const pluginsA = store.list("project-a");
      const pluginsB = store.list("project-b");

      // Assert
      expect(pluginsA).toHaveLength(1);
      expect(pluginsA[0].name).toBe("plugin-a");
      expect(pluginsB).toHaveLength(1);
      expect(pluginsB[0].name).toBe("plugin-b");
    });

    it("should disable a plugin", () => {
      // Arrange
      store.install({ projectId, name: "test-plugin", version: "1.0.0", path: "/plugins/test" });

      // Act
      store.setEnabled(projectId, "test-plugin", false);

      // Assert
      const plugin = store.get(projectId, "test-plugin");
      expect(plugin?.enabled).toBe(0);
    });

    it("should enable a disabled plugin", () => {
      // Arrange
      store.install({ projectId, name: "test-plugin", version: "1.0.0", path: "/plugins/test" });
      store.setEnabled(projectId, "test-plugin", false);

      // Act
      store.setEnabled(projectId, "test-plugin", true);

      // Assert
      const plugin = store.get(projectId, "test-plugin");
      expect(plugin?.enabled).toBe(1);
    });

    it("should remove a plugin", () => {
      // Arrange
      store.install({ projectId, name: "test-plugin", version: "1.0.0", path: "/plugins/test" });

      // Act
      store.remove(projectId, "test-plugin");

      // Assert
      expect(store.list(projectId)).toHaveLength(0);
      expect(store.get(projectId, "test-plugin")).toBeUndefined();
    });

    it("should return enabled plugins only when filtering", () => {
      // Arrange
      store.install({ projectId, name: "plugin-enabled", version: "1.0.0", path: "/a" });
      store.install({ projectId, name: "plugin-disabled", version: "1.0.0", path: "/b" });
      store.setEnabled(projectId, "plugin-disabled", false);

      // Act
      const enabled = store.listEnabled(projectId);

      // Assert
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe("plugin-enabled");
    });

    it("should persist and retrieve config JSON", () => {
      // Arrange
      const config = { apiKey: "test-123", maxRetries: 3 };
      store.install({ projectId, name: "config-plugin", version: "1.0.0", path: "/c", config });

      // Act
      const plugin = store.get(projectId, "config-plugin");

      // Assert
      expect(plugin?.config).toEqual(config);
    });
  });
});
