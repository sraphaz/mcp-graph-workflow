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
import path from "node:path";
import os from "node:os";
import { assertPathInside, PathTraversalError } from "../core/utils/safe-path.js";

describe("assertPathInside", () => {
  const root = path.join(os.tmpdir(), "safe-path-test-root");

  // ── Happy path ──

  it("should accept a simple filename inside root", () => {
    const result = assertPathInside("file.md", root);
    expect(result).toBe(path.resolve(root, "file.md"));
  });

  it("should accept nested subdirectory path", () => {
    const result = assertPathInside("sub/dir/file.md", root);
    expect(result).toBe(path.resolve(root, "sub/dir/file.md"));
  });

  it("should accept path that resolves to root exactly", () => {
    // root + "." should resolve to root itself — allowed
    const result = assertPathInside(".", root);
    expect(result).toBe(path.resolve(root));
  });

  // ── Basic traversal attacks ──

  it("should reject ../ traversal", () => {
    expect(() => assertPathInside("../etc/passwd", root)).toThrow(PathTraversalError);
  });

  it("should reject ../../ double traversal", () => {
    expect(() => assertPathInside("../../etc/passwd", root)).toThrow(PathTraversalError);
  });

  it("should reject absolute path outside root", () => {
    expect(() => assertPathInside("/etc/passwd", root)).toThrow(PathTraversalError);
  });

  it("should reject path that starts inside but escapes via ../", () => {
    expect(() => assertPathInside("sub/../../etc/passwd", root)).toThrow(PathTraversalError);
  });

  // ── Null byte injection ──

  it("should reject null byte in path", () => {
    expect(() => assertPathInside("file\0.md", root)).toThrow(PathTraversalError);
  });

  it("should reject null byte before extension", () => {
    expect(() => assertPathInside("malicious\0.txt", root)).toThrow(PathTraversalError);
  });

  // ── URL-encoded traversal ──

  it("should reject URL-encoded ../ (%2e%2e%2f)", () => {
    expect(() => assertPathInside("%2e%2e%2fpasswd", root)).toThrow(PathTraversalError);
  });

  it("should reject URL-encoded ../ (%2e%2e/)", () => {
    expect(() => assertPathInside("%2e%2e/etc/passwd", root)).toThrow(PathTraversalError);
  });

  it("should reject double URL-encoded (%252e%252e%252f)", () => {
    expect(() => assertPathInside("%252e%252e%252f", root)).toThrow(PathTraversalError);
  });

  // ── Windows backslash traversal ──

  it("should reject backslash traversal (..\\)", () => {
    expect(() => assertPathInside("..\\etc\\passwd", root)).toThrow(PathTraversalError);
  });

  it("should reject mixed slash traversal (../..\\)", () => {
    expect(() => assertPathInside("../..\\etc", root)).toThrow(PathTraversalError);
  });

  // ── Unicode normalization attacks ──

  it("should reject Unicode fullwidth dot traversal (．．/)", () => {
    expect(() => assertPathInside("\uFF0E\uFF0E/etc", root)).toThrow(PathTraversalError);
  });

  // ── Edge cases ──

  it("should reject empty candidate", () => {
    expect(() => assertPathInside("", root)).toThrow(PathTraversalError);
  });

  it("should accept path with legitimate dots in filename", () => {
    const result = assertPathInside("my.file.name.md", root);
    expect(result).toBe(path.resolve(root, "my.file.name.md"));
  });

  it("should accept deeply nested valid path", () => {
    const result = assertPathInside("a/b/c/d/e/f.txt", root);
    expect(result).toBe(path.resolve(root, "a/b/c/d/e/f.txt"));
  });

  // ── PathTraversalError properties ──

  it("should throw PathTraversalError with descriptive message", () => {
    try {
      assertPathInside("../secret", root);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PathTraversalError);
      expect((err as PathTraversalError).name).toBe("PathTraversalError");
      expect((err as PathTraversalError).message).toContain("Path traversal");
    }
  });

  it("should include candidate path in error", () => {
    try {
      assertPathInside("../secret", root);
      expect.fail("Should have thrown");
    } catch (err) {
      expect((err as PathTraversalError).candidatePath).toBe("../secret");
    }
  });
});
