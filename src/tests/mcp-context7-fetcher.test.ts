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

import { describe, it, expect, afterEach, vi } from "vitest";
import { createMcpContext7Fetcher } from "../core/docs/mcp-context7-fetcher.js";

describe("McpContext7Fetcher", () => {
  afterEach(() => {
    delete process.env.CONTEXT7_URL;
    vi.restoreAllMocks();
  });

  describe("resolveLibraryId", () => {
    it("should fall back to library name when CONTEXT7_URL not set", async () => {
      const fetcher = createMcpContext7Fetcher();
      const result = await fetcher.resolveLibraryId("express");
      expect(result).toBe("express");
    });

    it("should fall back to library name on fetch error", async () => {
      process.env.CONTEXT7_URL = "http://localhost:99999";
      const fetcher = createMcpContext7Fetcher({ timeout: 500 });
      const result = await fetcher.resolveLibraryId("react");
      expect(result).toBe("react");
    });
  });

  describe("queryDocs", () => {
    it("should return fallback message when CONTEXT7_URL not set", async () => {
      const fetcher = createMcpContext7Fetcher();
      const result = await fetcher.queryDocs("express");
      expect(result).toContain("[Context7]");
      expect(result).toContain("not available");
    });

    it("should return fallback on fetch error", async () => {
      process.env.CONTEXT7_URL = "http://localhost:99999";
      const fetcher = createMcpContext7Fetcher({ timeout: 500 });
      const result = await fetcher.queryDocs("zod");
      expect(result).toContain("[Context7]");
    });
  });

  it("should respect timeout option", async () => {
    const fetcher = createMcpContext7Fetcher({ timeout: 100 });
    // Should not hang — falls back quickly
    const result = await fetcher.resolveLibraryId("test-lib");
    expect(result).toBe("test-lib");
  });
});
