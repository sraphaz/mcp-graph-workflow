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
 * Tests for query expansion integration in multi-strategy-retrieval.
 *
 * AC1: PRF active + short query → log "query expanded"
 * AC3: queryExpansion: false → no expansion calls
 * AC4: Build passes (verified via typecheck)
 */

import { describe, it, expect, vi } from "vitest";
import { expandQuery } from "../core/rag/query-expander.js";

describe("query-expansion-integration", () => {
  // AC3: queryExpansion: false → no expansion
  it("should skip expansion when config.enabled is false", () => {
    const retriever = vi.fn().mockReturnValue([]);

    const result = expandQuery("auth", retriever, { enabled: false });

    expect(result.expanded).toBe(false);
    expect(result.expandedQuery).toBe("auth");
    expect(result.addedTerms).toHaveLength(0);
    expect(retriever).not.toHaveBeenCalled();
  });

  // AC1: PRF active → expands short query
  it("should expand query when retriever returns documents", () => {
    const retriever = vi.fn().mockReturnValue([
      { title: "Auth Module", content: "OAuth2 authentication with session management and token validation" },
      { title: "Login Flow", content: "User login via OAuth provider with session cookie and CSRF token" },
      { title: "Session Store", content: "Redis-backed session storage for authentication tokens" },
    ]);

    const result = expandQuery("auth", retriever);

    expect(result.expanded).toBe(true);
    expect(result.expandedQuery).toContain("auth");
    expect(result.addedTerms.length).toBeGreaterThan(0);
    expect(retriever).toHaveBeenCalledTimes(1);
  });

  // AC1: expansion doesn't add duplicate terms
  it("should not add terms already in the original query", () => {
    const retriever = vi.fn().mockReturnValue([
      { title: "Auth", content: "authentication system with OAuth" },
    ]);

    const result = expandQuery("authentication oauth", retriever);

    // Should not re-add "authentication" or "oauth"
    for (const term of result.addedTerms) {
      expect(term).not.toBe("authentication");
      expect(term).not.toBe("oauth");
    }
  });

  // Edge: empty retriever results → no expansion
  it("should not expand when retriever returns empty", () => {
    const retriever = vi.fn().mockReturnValue([]);

    const result = expandQuery("obscure-query", retriever);

    expect(result.expanded).toBe(false);
    expect(result.expandedQuery).toBe("obscure-query");
  });

  // Edge: maxTerms limit
  it("should respect maxTerms limit", () => {
    const retriever = vi.fn().mockReturnValue([
      { title: "Docs", content: "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu" },
    ]);

    const result = expandQuery("test", retriever, { maxTerms: 3 });

    expect(result.addedTerms.length).toBeLessThanOrEqual(3);
  });
});
