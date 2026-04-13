import { describe, it, expect } from "vitest";
import { McpGraphError, OnnxModelNotFoundError, ConflictError, LockConflictError } from "../core/utils/errors.js";
import { getOnnxProvider, isOnnxAvailable } from "../core/rag/onnx-embeddings.js";

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
});
