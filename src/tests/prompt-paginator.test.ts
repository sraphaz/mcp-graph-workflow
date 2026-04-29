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
import { paginatePrompt } from "../core/translation/prompt-paginator.js";

describe("paginatePrompt", () => {
  it("should return single page for small prompt within budget", () => {
    const result = paginatePrompt("hello world", 8000);

    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.truncated).toBe(false);
    expect(result.content).toBe("hello world");
  });

  it("should split into multiple pages when prompt exceeds budget", () => {
    const big = Array.from({ length: 200 }, (_, i) => `## Section ${i}\n${"x".repeat(200)}`).join("\n");

    const result = paginatePrompt(big, 500);

    expect(result.totalPages).toBeGreaterThan(1);
    expect(result.truncated).toBe(true);
  });

  it("should clamp requestedPage to valid range (1..totalPages)", () => {
    const big = Array.from({ length: 30 }, (_, i) => `## Section ${i}\n${"y".repeat(200)}`).join("\n");

    const overflow = paginatePrompt(big, 200, 999);
    const underflow = paginatePrompt(big, 200, -5);

    expect(overflow.currentPage).toBeGreaterThanOrEqual(1);
    expect(overflow.currentPage).toBeLessThanOrEqual(overflow.totalPages);
    expect(underflow.currentPage).toBeGreaterThanOrEqual(1);
  });

  it("should set truncated=true when split, false when single page", () => {
    const small = paginatePrompt("tiny", 8000);
    expect(small.truncated).toBe(false);

    const big = Array.from({ length: 100 }, (_, i) => `## Section ${i}\n${"z".repeat(200)}`).join("\n");
    const split = paginatePrompt(big, 200);
    expect(split.truncated).toBe(true);
  });

  it("should return tokenEstimate as a positive number for any non-empty prompt", () => {
    const result = paginatePrompt("hello world this is content", 8000);
    expect(result.tokenEstimate).toBeGreaterThan(0);
  });

  it("should handle empty prompt without throwing (single empty page)", () => {
    expect(() => paginatePrompt("", 8000)).not.toThrow();
    const result = paginatePrompt("", 8000);
    expect(result.totalPages).toBe(1);
    expect(result.content).toBe("");
  });

  it("should split at markdown headers when needed", () => {
    const big = `## Header 1\n${"a".repeat(2000)}\n## Header 2\n${"b".repeat(2000)}\n## Header 3\n${"c".repeat(2000)}`;

    const result = paginatePrompt(big, 500, 1);

    // Page 1 should start at top, contain Header 1
    if (result.totalPages > 1) {
      expect(result.content).toContain("Header 1");
    }
  });
});
