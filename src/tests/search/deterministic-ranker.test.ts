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
import {
  deterministicRank,
  scoresDriftWithinTolerance,
  type RankableItem,
} from "../../core/search/deterministic-ranker.js";

function item(id: string, score: number): RankableItem {
  return { id, score };
}

// ── AC 1: identical indices → identical order across runs ─────────────────

describe("deterministicRank (AC 1 — stable ordering)", () => {
  it("should produce identical order on two calls with same input", () => {
    const items: RankableItem[] = [
      item("node_c", 0.9),
      item("node_a", 0.7),
      item("node_b", 0.7),
    ];

    const run1 = deterministicRank([...items]);
    const run2 = deterministicRank([...items]);

    expect(run1.map(i => i.id)).toEqual(run2.map(i => i.id));
  });

  it("should sort by score descending (higher score first)", () => {
    const items: RankableItem[] = [
      item("z", 0.5),
      item("a", 0.9),
      item("m", 0.7),
    ];

    const result = deterministicRank(items);

    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("m");
    expect(result[2].id).toBe("z");
  });

  it("should not mutate the input array", () => {
    const items: RankableItem[] = [item("b", 0.5), item("a", 0.9)];
    const original = [...items];

    deterministicRank(items);

    expect(items).toEqual(original);
  });
});

// ── AC 2: tie-breaking by id ascending ────────────────────────────────────

describe("deterministicRank (AC 2 — tie-breaking by id)", () => {
  it("should break ties by id ascending when scores are equal", () => {
    const items: RankableItem[] = [
      item("node_c", 0.7),
      item("node_a", 0.7),
      item("node_b", 0.7),
    ];

    const result = deterministicRank(items);

    expect(result[0].id).toBe("node_a");
    expect(result[1].id).toBe("node_b");
    expect(result[2].id).toBe("node_c");
  });

  it("should handle mixed ties and non-ties deterministically", () => {
    const items: RankableItem[] = [
      item("z", 0.9),
      item("b", 0.5),
      item("a", 0.5),
      item("m", 0.7),
    ];

    const result = deterministicRank(items);

    expect(result[0].id).toBe("z");
    expect(result[1].id).toBe("m");
    expect(result[2].id).toBe("a");
    expect(result[3].id).toBe("b");
  });

  it("should be stable: same input always produces same winner on tie", () => {
    const items: RankableItem[] = [item("omega", 1.0), item("alpha", 1.0)];

    const results = Array.from({ length: 5 }, () =>
      deterministicRank([...items]).map(i => i.id),
    );

    const firstRun = results[0];
    for (const run of results) {
      expect(run).toEqual(firstRun);
    }
    expect(firstRun[0]).toBe("alpha");
  });
});

// ── AC 3: reindex drift within tolerance ──────────────────────────────────

describe("scoresDriftWithinTolerance (AC 3 — drift check)", () => {
  it("should return true when all scores are within tolerance", () => {
    const before: RankableItem[] = [item("a", 0.9000), item("b", 0.5000)];
    const after: RankableItem[] = [item("a", 0.9001), item("b", 0.5002)];

    expect(scoresDriftWithinTolerance(before, after, 0.001)).toBe(true);
  });

  it("should return false when any score exceeds tolerance", () => {
    const before: RankableItem[] = [item("a", 0.9), item("b", 0.5)];
    const after: RankableItem[] = [item("a", 0.9), item("b", 0.6)];

    expect(scoresDriftWithinTolerance(before, after, 0.001)).toBe(false);
  });

  it("should return true when sets are identical", () => {
    const items: RankableItem[] = [item("a", 0.8), item("b", 0.6)];

    expect(scoresDriftWithinTolerance(items, items, 0.0)).toBe(true);
  });

  it("should return true for newly added items (no before entry)", () => {
    const before: RankableItem[] = [item("a", 0.8)];
    const after: RankableItem[] = [item("a", 0.8001), item("b", 0.5)];

    expect(scoresDriftWithinTolerance(before, after, 0.001)).toBe(true);
  });

  it("should return false when before has items missing from after", () => {
    const before: RankableItem[] = [item("a", 0.8), item("b", 0.6)];
    const after: RankableItem[] = [item("a", 0.9)];

    expect(scoresDriftWithinTolerance(before, after, 0.001)).toBe(false);
  });
});
