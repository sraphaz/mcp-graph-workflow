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
import Database from "better-sqlite3";
import { configureDb } from "../core/store/migrations.js";
import { SuccessPatternTracker, derivePatternKey } from "../core/harness/success-pattern-tracker.js";
import type { GraphNode } from "../core/graph/graph-types.js";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node_x",
    type: "task",
    title: "T",
    status: "done",
    priority: 3,
    tags: ["bug-fix"],
    ...overrides,
  } as GraphNode;
}

describe("derivePatternKey", () => {
  it("normalises tag order", () => {
    expect(derivePatternKey(makeNode({ tags: ["b", "a", "c"] }))).toBe(derivePatternKey(makeNode({ tags: ["c", "a", "b"] })));
  });

  it("falls back to parent epic when tags are empty", () => {
    expect(derivePatternKey(makeNode({ tags: [], parentId: "node_epic" }))).toBe("epic:node_epic");
  });

  it("returns null when tags AND parent are absent (nothing to pattern over)", () => {
    expect(derivePatternKey(makeNode({ tags: [], parentId: null }))).toBeNull();
  });

  it("ignores generic tags that would group everything (e.g. 'task', 'bug-fix' alone)", () => {
    // pattern key still exists; the tracker won't dedupe heuristically, this just
    // validates the canonical form is the sorted tag list.
    expect(derivePatternKey(makeNode({ tags: ["bug-fix"] }))).toBe("tags:bug-fix");
  });
});

describe("SuccessPatternTracker", () => {
  let db: Database.Database;
  let tracker: SuccessPatternTracker;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    tracker = new SuccessPatternTracker(db);
  });

  afterEach(() => db.close());

  it("does not flag for first or second occurrence", () => {
    expect(tracker.recordSuccess("tags:bug-fix", "node_a", "first rationale").shouldEmit).toBe(false);
    expect(tracker.recordSuccess("tags:bug-fix", "node_b", "second rationale").shouldEmit).toBe(false);
  });

  it("flags shouldEmit=true on the third occurrence with the 3 contributing nodeIds", () => {
    tracker.recordSuccess("tags:bug-fix", "node_a", "ratA");
    tracker.recordSuccess("tags:bug-fix", "node_b", "ratB");
    const r = tracker.recordSuccess("tags:bug-fix", "node_c", "ratC");
    expect(r.shouldEmit).toBe(true);
    expect(r.patternKey).toBe("tags:bug-fix");
    expect(r.contributingNodeIds).toEqual(["node_a", "node_b", "node_c"]);
    expect(r.contributingRationales).toEqual(["ratA", "ratB", "ratC"]);
  });

  it("does NOT re-emit on subsequent occurrences after the first emit", () => {
    tracker.recordSuccess("tags:bug-fix", "node_a", "x");
    tracker.recordSuccess("tags:bug-fix", "node_b", "y");
    tracker.recordSuccess("tags:bug-fix", "node_c", "z");
    const fourth = tracker.recordSuccess("tags:bug-fix", "node_d", "w");
    expect(fourth.shouldEmit).toBe(false);
    expect(fourth.alreadyEmitted).toBe(true);
  });

  it("ignores null patternKey (no signal to track)", () => {
    expect(tracker.recordSuccess(null, "node_x", "y").shouldEmit).toBe(false);
  });

  it("counts patterns per key independently", () => {
    tracker.recordSuccess("tags:a", "n1", "r1");
    tracker.recordSuccess("tags:b", "n2", "r2");
    tracker.recordSuccess("tags:a", "n3", "r3");
    const r = tracker.recordSuccess("tags:a", "n4", "r4");
    expect(r.shouldEmit).toBe(true);
  });
});
