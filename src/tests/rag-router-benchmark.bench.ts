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
 * Adaptive RAG Router Benchmark — measures routing latency by query complexity.
 */

import { bench, describe } from "vitest";
import { routeQuery } from "../core/rag/adaptive-router.js";
import { understandQuery } from "../core/rag/query-understanding.js";

// ── Query fixtures by complexity ──────────────────────

const SIMPLE_QUERIES = [
  "status of sprint 3",
  "history of node_abc",
  "what is the current progress",
  "when was the last deployment",
  "show sprint burndown",
];

const MODERATE_QUERIES = [
  "how to implement OAuth2 in the auth module",
  "search knowledge about SQLite migrations with source:memory",
  "how does the RAG pipeline process embeddings",
  "find tasks related to authentication and authorization",
  "how to configure BM25 parameters for domain tuning",
];

const COMPLEX_QUERIES = [
  "debug why the context compressor drops relevant chunks when token budget is low",
  "compare BM25 ranking vs TF-IDF scoring for PRD content retrieval accuracy",
  "why does the planner fail to decompose epics with circular dependencies in multi-project graphs",
  "compare sprint velocity across projects filtering by source:memory source:capture source:docs",
  "debug authentication flow between OAuth2 provider SAML gateway and multi-tenant session manager",
];

// ── Benchmarks ────────────────────────────────────────

describe("RAG Router — simple queries", () => {
  const understood = SIMPLE_QUERIES.map(understandQuery);

  bench("route 5 simple queries", () => {
    for (const u of understood) {
      routeQuery(u);
    }
  });
});

describe("RAG Router — moderate queries", () => {
  const understood = MODERATE_QUERIES.map(understandQuery);

  bench("route 5 moderate queries", () => {
    for (const u of understood) {
      routeQuery(u);
    }
  });
});

describe("RAG Router — complex queries", () => {
  const understood = COMPLEX_QUERIES.map(understandQuery);

  bench("route 5 complex queries", () => {
    for (const u of understood) {
      routeQuery(u);
    }
  });
});

describe("RAG Router — end-to-end (understand + route)", () => {
  bench("understand + route simple query", () => {
    const u = understandQuery("status of sprint 3");
    routeQuery(u);
  });

  bench("understand + route moderate query", () => {
    const u = understandQuery("how to implement OAuth2 in the auth module");
    routeQuery(u);
  });

  bench("understand + route complex query", () => {
    const u = understandQuery(
      "debug why the context compressor drops relevant chunks when token budget is low",
    );
    routeQuery(u);
  });
});
