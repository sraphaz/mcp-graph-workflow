/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-21.T08 — session resume detector tests.
 */

import { describe, it, expect } from "vitest";
import {
  computeResumeDelta,
  isSessionResumeDisabled,
  SESSION_GAP_THRESHOLD_MS,
  RESUME_NODES_LIMIT,
  RESUME_COMMITS_LIMIT,
} from "../core/hooks/session-resume-detector.js";

const HOUR = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe("session-resume-detector (E21.T08)", () => {
  it("constants: gap=1h, nodesLimit=20, commitsLimit=10", () => {
    expect(SESSION_GAP_THRESHOLD_MS).toBe(HOUR);
    expect(RESUME_NODES_LIMIT).toBe(20);
    expect(RESUME_COMMITS_LIMIT).toBe(10);
  });

  it("no_prior_session when lastSessionMs is undefined", () => {
    const r = computeResumeDelta({
      lastSessionMs: undefined,
      nowMs: NOW,
      nodes: [],
      commits: [],
    });
    expect(r.resume).toBe(false);
    expect(r.reason).toBe("no_prior_session");
  });

  it("gap_below_threshold when gap <= 1h", () => {
    const r = computeResumeDelta({
      lastSessionMs: NOW - 30 * 60 * 1000,
      nowMs: NOW,
      nodes: [{ id: "a", title: "A", updatedAtMs: NOW - 10 * 60 * 1000 }],
      commits: [],
    });
    expect(r.resume).toBe(false);
    expect(r.reason).toBe("gap_below_threshold");
    expect(r.nodesModified).toEqual([]);
  });

  it("emits delta when gap > 1h, includes nodes updated after last session", () => {
    const last = NOW - 4 * HOUR;
    const r = computeResumeDelta({
      lastSessionMs: last,
      nowMs: NOW,
      nodes: [
        { id: "old", title: "old", updatedAtMs: last - HOUR },
        { id: "n1", title: "n1", updatedAtMs: last + HOUR },
        { id: "n2", title: "n2", updatedAtMs: last + 2 * HOUR },
      ],
      commits: [
        { sha: "abc", message: "m1", timestampMs: last + 30 * 60 * 1000 },
        { sha: "old-c", message: "old", timestampMs: last - 60_000 },
      ],
    });
    expect(r.resume).toBe(true);
    expect(r.reason).toBe("delta_emitted");
    expect(r.nodesModified.map((n) => n.id)).toEqual(["n2", "n1"]);
    expect(r.commits.map((c) => c.sha)).toEqual(["abc"]);
  });

  it("nodesModified sorted DESC by updatedAt and capped at RESUME_NODES_LIMIT", () => {
    const last = NOW - 10 * HOUR;
    const nodes = Array.from({ length: 30 }, (_, i) => ({
      id: `n${i}`,
      title: `n${i}`,
      updatedAtMs: last + (i + 1) * 60_000,
    }));
    const r = computeResumeDelta({
      lastSessionMs: last,
      nowMs: NOW,
      nodes,
      commits: [],
    });
    expect(r.nodesModified).toHaveLength(20);
    expect(r.nodesModified[0].id).toBe("n29");
  });

  it("commits sorted DESC by timestamp and capped at RESUME_COMMITS_LIMIT", () => {
    const last = NOW - 10 * HOUR;
    const commits = Array.from({ length: 15 }, (_, i) => ({
      sha: `c${i}`,
      message: `m${i}`,
      timestampMs: last + (i + 1) * 60_000,
    }));
    const r = computeResumeDelta({
      lastSessionMs: last,
      nowMs: NOW,
      nodes: [],
      commits,
    });
    expect(r.commits).toHaveLength(10);
    expect(r.commits[0].sha).toBe("c14");
  });

  it("isSessionResumeDisabled respects MCP_GRAPH_SESSION_RESUME=off", () => {
    expect(isSessionResumeDisabled({ MCP_GRAPH_SESSION_RESUME: "off" })).toBe(true);
    expect(isSessionResumeDisabled({})).toBe(false);
  });
});
