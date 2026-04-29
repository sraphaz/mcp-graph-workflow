/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T07 — memory staleness tests.
 */

import { describe, it, expect } from "vitest";
import {
  findStaleMemories,
  isMemoryStalenessDisabled,
  STALE_AGE_DAYS,
  STALENESS_LIMIT,
} from "../core/hooks/memory-staleness.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe("memory-staleness (E21.T07)", () => {
  it("STALE_AGE_DAYS = 30, STALENESS_LIMIT = 10", () => {
    expect(STALE_AGE_DAYS).toBe(30);
    expect(STALENESS_LIMIT).toBe(10);
  });

  it("returns [] when no memories exceed age threshold", () => {
    const fresh = [
      { id: "m1", title: "fresh", updatedAt: NOW - 5 * DAY_MS },
      { id: "m2", title: "fresh", updatedAt: NOW - 20 * DAY_MS },
    ];
    expect(findStaleMemories(fresh, NOW)).toEqual([]);
  });

  it("filters memories older than 30d", () => {
    const memories = [
      { id: "old1", title: "old1", updatedAt: NOW - 60 * DAY_MS },
      { id: "fresh", title: "fresh", updatedAt: NOW - 5 * DAY_MS },
      { id: "old2", title: "old2", updatedAt: NOW - 90 * DAY_MS },
    ];
    const result = findStaleMemories(memories, NOW);
    expect(result.map((r) => r.id).sort()).toEqual(["old1", "old2"]);
    expect(result.find((r) => r.id === "fresh")).toBeUndefined();
  });

  it("sorts ASC by updatedAt (oldest first)", () => {
    const memories = [
      { id: "newer", title: "newer", updatedAt: NOW - 31 * DAY_MS },
      { id: "oldest", title: "oldest", updatedAt: NOW - 200 * DAY_MS },
      { id: "middle", title: "middle", updatedAt: NOW - 60 * DAY_MS },
    ];
    const result = findStaleMemories(memories, NOW);
    expect(result.map((r) => r.id)).toEqual(["oldest", "middle", "newer"]);
  });

  it("caps at limit (default 10)", () => {
    const memories = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i}`,
      title: `m${i}`,
      updatedAt: NOW - (40 + i) * DAY_MS,
    }));
    expect(findStaleMemories(memories, NOW)).toHaveLength(10);
  });

  it("computes ageDays correctly", () => {
    const memories = [
      { id: "m", title: "m", updatedAt: NOW - 45 * DAY_MS },
    ];
    const result = findStaleMemories(memories, NOW);
    expect(result[0].ageDays).toBe(45);
  });

  it("supports custom ageDays threshold", () => {
    const memories = [
      { id: "m1", title: "m1", updatedAt: NOW - 8 * DAY_MS },
      { id: "m2", title: "m2", updatedAt: NOW - 15 * DAY_MS },
    ];
    const result = findStaleMemories(memories, NOW, 7);
    expect(result.map((r) => r.id).sort()).toEqual(["m1", "m2"]);
  });

  it("isMemoryStalenessDisabled respects env", () => {
    expect(isMemoryStalenessDisabled({ MCP_GRAPH_MEMORY_STALENESS: "off" })).toBe(true);
    expect(isMemoryStalenessDisabled({})).toBe(false);
  });
});
