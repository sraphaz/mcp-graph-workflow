/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 19 — Multi-Agent Topologies (E19.T02).
 * Tests for hierarchical topology (queen + workers).
 */

import { describe, it, expect } from "vitest";
import {
  getQueenId,
  getWorkerIds,
  buildDispatchRoutes,
  buildReportRoutes,
  buildHierarchicalLayout,
} from "../core/swarm/topologies/hierarchical.js";

describe("hierarchical topology (E19.T02)", () => {
  it("getQueenId returns the first agent", () => {
    expect(getQueenId(["q", "w1", "w2"])).toBe("q");
  });

  it("getQueenId throws when no agents provided", () => {
    expect(() => getQueenId([])).toThrow();
  });

  it("getWorkerIds returns all but the queen", () => {
    expect(getWorkerIds(["q", "w1", "w2", "w3"])).toEqual(["w1", "w2", "w3"]);
  });

  it("getWorkerIds returns empty array when only queen present", () => {
    expect(getWorkerIds(["q"])).toEqual([]);
  });

  it("buildDispatchRoutes maps queen → each worker (one-to-many)", () => {
    const routes = buildDispatchRoutes("q", ["w1", "w2", "w3"]);
    expect(routes).toEqual({ q: ["w1", "w2", "w3"] });
  });

  it("buildDispatchRoutes returns queen → [] when no workers", () => {
    expect(buildDispatchRoutes("q", [])).toEqual({ q: [] });
  });

  it("buildReportRoutes maps each worker → queen", () => {
    const routes = buildReportRoutes("q", ["w1", "w2"]);
    expect(routes).toEqual({ w1: "q", w2: "q" });
  });

  it("buildHierarchicalLayout combines queen + workers + dispatch + report", () => {
    const layout = buildHierarchicalLayout(["q", "w1", "w2"]);
    expect(layout.queen).toBe("q");
    expect(layout.workers).toEqual(["w1", "w2"]);
    expect(layout.dispatch).toEqual({ q: ["w1", "w2"] });
    expect(layout.report).toEqual({ w1: "q", w2: "q" });
  });

  it("buildHierarchicalLayout requires at least one agent (the queen)", () => {
    expect(() => buildHierarchicalLayout([])).toThrow();
  });

  it("buildHierarchicalLayout works with only the queen (no workers)", () => {
    const layout = buildHierarchicalLayout(["solo"]);
    expect(layout.queen).toBe("solo");
    expect(layout.workers).toEqual([]);
    expect(layout.dispatch).toEqual({ solo: [] });
    expect(layout.report).toEqual({});
  });
});
