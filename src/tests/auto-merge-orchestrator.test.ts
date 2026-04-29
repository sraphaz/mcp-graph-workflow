/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { describe, it, expect } from "vitest";
import {
  decideCloseBatch,
  decidePostMergeAction,
  shouldAttemptRevert,
  type BatchSnapshot,
} from "../core/autonomy/auto-merge-orchestrator.js";

function snap(overrides: Partial<BatchSnapshot> = {}): BatchSnapshot {
  return {
    state: { kind: "BATCH_OPEN", commitsInBatch: 3 },
    tasksDone: 5,
    tasksOpen: 0,
    testsGreen: true,
    harnessGrade: "B",
    commitsAhead: 5,
    ...overrides,
  };
}

describe("decideCloseBatch", () => {
  it("closes when everything is green", () => {
    expect(decideCloseBatch(snap()).action).toBe("close-batch");
  });

  it("stays open when tasks remain", () => {
    expect(decideCloseBatch(snap({ tasksOpen: 1 })).action).toBe("stay-open");
  });

  it("stays open when tests are red", () => {
    expect(decideCloseBatch(snap({ testsGreen: false })).action).toBe("stay-open");
  });

  it("stays open when harness below floor (default B)", () => {
    expect(decideCloseBatch(snap({ harnessGrade: "C" })).action).toBe("stay-open");
  });

  it("respects custom floor", () => {
    expect(
      decideCloseBatch(snap({ harnessGrade: "C" }), { minHarnessGrade: "C" }).action,
    ).toBe("close-batch");
  });

  it("force-closes when commitsAhead exceeds cap", () => {
    expect(
      decideCloseBatch(snap({ commitsAhead: 25 }), { maxCommitsBeforeForce: 20 }).action,
    ).toBe("force-close");
  });

  it("returns stay-open if state is not BATCH_OPEN", () => {
    expect(
      decideCloseBatch(
        snap({ state: { kind: "BATCH_CLOSED", prNumber: 1, headSha: "abc" } }),
      ).action,
    ).toBe("stay-open");
  });

  it("stays open when harness grade unknown", () => {
    expect(decideCloseBatch(snap({ harnessGrade: null })).action).toBe("stay-open");
  });
});

describe("decidePostMergeAction", () => {
  it("auto-reverts when CI red", () => {
    const r = decidePostMergeAction({
      testsGreenAfter: false,
      harnessBefore: "A",
      harnessAfter: "A",
    });
    expect(r.action).toBe("auto-revert");
  });

  it("auto-reverts on 2-grade harness drop", () => {
    const r = decidePostMergeAction({
      testsGreenAfter: true,
      harnessBefore: "A",
      harnessAfter: "C",
    });
    expect(r.action).toBe("auto-revert");
  });

  it("opens issue only on 1-grade drop", () => {
    const r = decidePostMergeAction({
      testsGreenAfter: true,
      harnessBefore: "A",
      harnessAfter: "B",
    });
    expect(r.action).toBe("open-issue-only");
  });

  it("no regression when grade stays same and tests green", () => {
    const r = decidePostMergeAction({
      testsGreenAfter: true,
      harnessBefore: "B",
      harnessAfter: "B",
    });
    expect(r.action).toBe("no-regression");
  });

  it("treats null grades as 'no-regression' once tests are green", () => {
    const r = decidePostMergeAction({
      testsGreenAfter: true,
      harnessBefore: null,
      harnessAfter: null,
    });
    expect(r.action).toBe("no-regression");
  });
});

describe("shouldAttemptRevert (anti-loop guard)", () => {
  it("allows the first revert with empty history", () => {
    expect(shouldAttemptRevert(["src/foo.ts"], [])).toBe(true);
  });

  it("blocks the second revert that overlaps prior auto-revert", () => {
    expect(shouldAttemptRevert(["src/foo.ts", "src/bar.ts"], ["src/foo.ts"])).toBe(false);
  });

  it("allows revert when files don't overlap prior", () => {
    expect(shouldAttemptRevert(["src/baz.ts"], ["src/foo.ts"])).toBe(true);
  });
});
