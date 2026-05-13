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

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { homedir } from "node:os";
import { McpGraphError, OnnxModelNotFoundError, ConflictError, LockConflictError } from "../core/utils/errors.js";
import { getOnnxProvider, isOnnxAvailable } from "../core/rag/onnx-embeddings.js";

// Shared cache — same path as onnx-download-cache-audit.test.ts to avoid duplicate 23 MB downloads.
const ONNX_TEST_CACHE = join(homedir(), ".cache", "mcp-graph", "onnx-test");

describe("ONNX module contract", () => {
  it("OnnxModelNotFoundError is a McpGraphError", () => {
    const err = new OnnxModelNotFoundError("/path/to/model");
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err.name).toBe("OnnxModelNotFoundError");
  });

  it("ConflictError contains details", () => {
    const details = {
      currentVersion: 3,
      expectedVersion: 2,
      modifiedBy: "agent-a",
      modifiedAt: "2026-01-01T00:00:00Z",
    };
    const err = new ConflictError(details);
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err.details).toEqual(details);
    expect(err.details.currentVersion).toBe(3);
  });

  it("LockConflictError contains lock owner info", () => {
    const details = {
      resourceId: "node-123",
      owner: "agent-b",
      acquiredAt: "2026-01-01T00:00:00Z",
      expiresAt: "2026-01-01T01:00:00Z",
    };
    const err = new LockConflictError(details);
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err.details.owner).toBe("agent-b");
    expect(err.details.resourceId).toBe("node-123");
  });

  it("getOnnxProvider is exported as a function", () => {
    expect(typeof getOnnxProvider).toBe("function");
  });

  it("isOnnxAvailable is exported as a function", () => {
    expect(typeof isOnnxAvailable).toBe("function");
  });

  it("getOnnxProvider returns null or object (graceful when ONNX unavailable)", async () => {
    const result = await getOnnxProvider("/nonexistent/path");
    // Should gracefully return null when ONNX runtime is not available
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("isOnnxAvailable returns a boolean", async () => {
    const result = await isOnnxAvailable();
    expect(typeof result).toBe("boolean");
  });

  it("getOnnxProvider caches provider by modelsDir (same reference on repeated calls)", async () => {
    // Both should resolve to the same value — either null (ONNX unavailable)
    // or the same provider instance (cached). Creating two providers with the
    // same modelsDir would each load a ~23MB ONNX session — dedup is critical.
    const [p1, p2] = await Promise.all([
      getOnnxProvider(ONNX_TEST_CACHE),
      getOnnxProvider(ONNX_TEST_CACHE),
    ]);
    expect(p1).toBe(p2);
  });
});
