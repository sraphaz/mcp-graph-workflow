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
 * Validation-path tests for siebel-handlers MCP handlers.
 * Focused on input validation (mcpError responses) and unknown-action
 * dispatch — paths that don't touch the filesystem.
 *
 * Filesystem-dependent paths (list/add/remove env, SIF parsing) are covered
 * by integration tests in src/tests/api-siebel*.test.ts and unit tests in
 * src/tests/siebel-*.test.ts for the underlying core modules.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  handleSiebelEnv,
  handleSiebelSearch,
  handleSiebelValidate,
  handleSiebelImportSif,
  handleSiebelGenerate,
} from "../mcp/tools/siebel-handlers.js";

describe("siebel-handlers — validation paths", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("siebel-test");
  });

  afterEach(() => {
    store.close();
  });

  describe("handleSiebelEnv", () => {
    it("should return error response when envAction is missing", async () => {
      const result = await handleSiebelEnv(store, { action: "env" });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toMatch(/envAction is required/i);
    });

    it("should return error response when add action is missing name", async () => {
      const result = await handleSiebelEnv(store, { action: "env",
        envAction: "add",
        url: "https://example.com",
      });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toMatch(/name and url are required/i);
    });

    it("should return error response when add action is missing url", async () => {
      const result = await handleSiebelEnv(store, { action: "env",
        envAction: "add",
        name: "dev",
      });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toMatch(/name and url are required/i);
    });

    it("should return error response when remove action is missing name", async () => {
      const result = await handleSiebelEnv(store, { action: "env", envAction: "remove" } as Parameters<typeof handleSiebelEnv>[1]);

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toMatch(/name is required/i);
    });

    it("should return error response for unknown env action", async () => {
      const result = await handleSiebelEnv(store, {
        action: "env",
        envAction: "destroy",
      });

      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toMatch(/Unknown env action/i);
    });
  });

  describe("handleSiebelImportSif", () => {
    it("should return error response when no SIF file path provided", async () => {
      // The handler requires a path or content; with neither, it errors.
      const result = await handleSiebelImportSif(store, { action: "import_sif" });

      expect(result.isError).toBe(true);
    });
  });

  describe("handleSiebelValidate", () => {
    it("should return a structured response for an empty params payload", async () => {
      // Validation handler should not throw on empty input — it should
      // return either an error response or a structured "nothing to validate"
      // result. Either way, it must surface a McpToolResponse, not throw.
      const result = await handleSiebelValidate(store, { action: "validate" });

      // McpToolResponse has either isError or content, never throws.
      expect(result).toBeDefined();
      expect(result).toHaveProperty("content");
    });
  });

  describe("handleSiebelSearch", () => {
    it("should not throw on empty store + minimal params", async () => {
      // Empty store, minimal payload — handler should produce a response
      // (likely empty results) rather than crash.
      const result = await handleSiebelSearch(store, { action: "search", objectName: "anything" });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("content");
    });
  });

  describe("handleSiebelGenerate", () => {
    it("should return error response when sifAction is missing", async () => {
      const result = await handleSiebelGenerate(store, { action: "generate" });

      expect(result.isError).toBe(true);
    });
  });
});
