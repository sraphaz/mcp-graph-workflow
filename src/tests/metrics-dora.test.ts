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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { buildDoraMetricsResponse } from "../mcp/tools/metrics.js";

describe("metrics({mode: 'dora_metrics'}) — V11 Maestro Phase 5.4", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  it("returns the same shape that forecast(mode=dora) returned", () => {
    const r = buildDoraMetricsResponse(store);
    expect(r.ok).toBe(true);
    expect(r.mode).toBe("dora_metrics");
    expect(r.metrics).toBeDefined();
    expect(r.metrics.deploymentFrequency).toBeTypeOf("number");
    expect(r.metrics.leadTime).toBeDefined();
    expect(r.metrics.changeFailureRate).toBeTypeOf("number");
    expect(r.metrics.mttr).toBeTypeOf("number");
  });

  it("returns interpretation labels for each metric", () => {
    const r = buildDoraMetricsResponse(store);
    expect(r.ok).toBe(true);
    expect(r.interpretation.deploymentFrequency).toMatch(/Elite|High|Needs improvement/);
    expect(r.interpretation.leadTime).toMatch(/Elite|High|Needs improvement/);
    expect(r.interpretation.changeFailureRate).toMatch(/Elite|High|Needs improvement/);
    expect(r.interpretation.mttr).toMatch(/Elite|High|Needs improvement/);
  });

  it("returns ok=false when no project is initialized", () => {
    const empty = SqliteStore.open(":memory:");
    try {
      const r = buildDoraMetricsResponse(empty);
      expect(r.ok).toBe(false);
    } finally {
      empty.close();
    }
  });
});
