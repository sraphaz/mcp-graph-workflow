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

/**
 * Tests for LspServerManager — focuses on the pure-state surface.
 *
 * Methods that spawn external LSP binaries (ensureServer, startServer,
 * isServerInstalled) require integration setup and are exercised end-to-end
 * by lsp-bridge tests; this file isolates the manager's pre-spawn API:
 * constructor wiring, status reporting on empty/registry-only state, and
 * shutdown idempotence.
 */

import { describe, it, expect } from "vitest";
import { LspServerManager } from "../core/lsp/lsp-server-manager.js";
import { ServerRegistry } from "../core/lsp/server-registry.js";

describe("LspServerManager", () => {
  describe("constructor", () => {
    it("should accept a ServerRegistry + rootUri without throwing", () => {
      const registry = new ServerRegistry();
      expect(
        () => new LspServerManager(registry, "file:///tmp/project"),
      ).not.toThrow();
    });

    it("should accept a custom keepAliveMs", () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp", 60_000);
      expect(manager).toBeDefined();
    });
  });

  describe("getStatus", () => {
    it("should return a Map keyed by languageId", () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      const status = manager.getStatus();

      expect(status).toBeInstanceOf(Map);
    });

    it("should include all registry-known languages even when no server is running (status='stopped')", () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      const status = manager.getStatus();
      const knownLanguages = registry.getAllConfigs().map((c) => c.languageId);

      // Every language in the registry should be reported.
      for (const lang of knownLanguages) {
        const state = status.get(lang);
        expect(state).toBeDefined();
        expect(state?.status).toBe("stopped");
      }
    });

    it("should report each known language with the correct languageId field", () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      const status = manager.getStatus();

      for (const [langId, state] of status) {
        expect(state.languageId).toBe(langId);
      }
    });
  });

  describe("shutdownAll", () => {
    it("should resolve cleanly when no servers are running", async () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      await expect(manager.shutdownAll()).resolves.toBeUndefined();
    });

    it("should be idempotent (calling twice doesn't throw)", async () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      await manager.shutdownAll();
      await expect(manager.shutdownAll()).resolves.toBeUndefined();
    });

    it("should leave getStatus() reflecting registry-only state after shutdown", async () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      await manager.shutdownAll();
      const status = manager.getStatus();

      // All entries should be 'stopped' (none were started anyway).
      for (const state of status.values()) {
        expect(state.status).toBe("stopped");
      }
    });
  });

  describe("ensureServer (offline paths)", () => {
    it("should return null when language is not in registry", async () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      const client = await manager.ensureServer("klingon");
      expect(client).toBeNull();
    });
  });

  describe("getClientForFile (offline paths)", () => {
    it("should return null when no language matches the file extension", async () => {
      const registry = new ServerRegistry();
      const manager = new LspServerManager(registry, "file:///tmp");

      // .xyz is not registered for any language.
      const client = await manager.getClientForFile("/tmp/foo.xyz");
      expect(client).toBeNull();
    });
  });
});
