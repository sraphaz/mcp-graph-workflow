/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §SprintE — Auto-merge orchestrator state machine.
 *
 * Pure decision module. Holds the BATCH_OPEN → BATCH_CLOSED →
 * POST_MERGE_REGRESSION transitions. Side-effects (git revert, gh PR
 * create, gh issue open) are performed by the caller; the orchestrator
 * only **decides** which transition is allowed and what arguments to
 * pass.
 *
 *   ┌─────────────────┐
 *   │  BATCH_OPEN     │  ← agent commits fast-forward locally
 *   └────────┬────────┘
 *            │ all tasks done + tests green + harness ≥ B
 *            ▼
 *   ┌─────────────────┐
 *   │  BATCH_CLOSED   │  ← gh pr create against base
 *   └────────┬────────┘
 *            │ CI passes ──► merged
 *            │ CI regresses
 *            ▼
 *   ┌────────────────────────────┐
 *   │  POST_MERGE_REGRESSION     │  ← bisect → revert → issue
 *   └────────────────────────────┘
 */

export type BatchState =
  | { readonly kind: "BATCH_OPEN"; readonly commitsInBatch: number }
  | { readonly kind: "BATCH_CLOSED"; readonly prNumber: number | null; readonly headSha: string }
  | {
      readonly kind: "POST_MERGE_REGRESSION";
      readonly suspectSha: string | null;
      readonly issueNumber: number | null;
    };

export interface BatchSnapshot {
  readonly state: BatchState;
  readonly tasksDone: number;
  readonly tasksOpen: number;
  readonly testsGreen: boolean;
  readonly harnessGrade: "A" | "B" | "C" | "D" | "F" | null;
  readonly commitsAhead: number;
}

export type CloseDecision =
  | { readonly action: "stay-open"; readonly reason: string }
  | { readonly action: "close-batch"; readonly reason: string }
  | { readonly action: "force-close"; readonly reason: string };

export interface CloseBatchOptions {
  readonly maxCommitsBeforeForce?: number;
  readonly minHarnessGrade?: "A" | "B" | "C";
}

const GRADE_ORDER: Record<"A" | "B" | "C" | "D" | "F", number> = {
  A: 4,
  B: 3,
  C: 2,
  D: 1,
  F: 0,
};

/**
 * Decide whether the current batch should be closed (PR submitted).
 *
 * Rules:
 *   - any open task or red test → stay-open
 *   - harness below the configured floor → stay-open
 *   - everything green → close-batch
 *   - commitsAhead exceeds the cap → force-close (caller can warn user)
 */
export function decideCloseBatch(
  snapshot: BatchSnapshot,
  options: CloseBatchOptions = {},
): CloseDecision {
  const maxCommits = options.maxCommitsBeforeForce ?? 20;
  const floor = options.minHarnessGrade ?? "B";

  if (snapshot.state.kind !== "BATCH_OPEN") {
    return { action: "stay-open", reason: `state is ${snapshot.state.kind}, not BATCH_OPEN` };
  }

  if (snapshot.commitsAhead > maxCommits) {
    return {
      action: "force-close",
      reason: `commitsAhead=${snapshot.commitsAhead} exceeds cap (${maxCommits}) — close before bisect cost grows`,
    };
  }

  if (snapshot.tasksOpen > 0) {
    return { action: "stay-open", reason: `${snapshot.tasksOpen} tasks still open` };
  }

  if (!snapshot.testsGreen) {
    return { action: "stay-open", reason: "test suite is red" };
  }

  if (snapshot.harnessGrade === null) {
    return { action: "stay-open", reason: "harness grade unknown — run analyze(harness_scan) first" };
  }

  if (GRADE_ORDER[snapshot.harnessGrade] < GRADE_ORDER[floor]) {
    return {
      action: "stay-open",
      reason: `harness grade ${snapshot.harnessGrade} below floor ${floor}`,
    };
  }

  return {
    action: "close-batch",
    reason: `${snapshot.tasksDone} tasks done, tests green, harness ${snapshot.harnessGrade}`,
  };
}

export interface RegressionInputs {
  /** harness grade BEFORE the merge */
  readonly harnessBefore: "A" | "B" | "C" | "D" | "F" | null;
  /** harness grade AFTER the merge */
  readonly harnessAfter: "A" | "B" | "C" | "D" | "F" | null;
  /** CI / test verdict after the merge */
  readonly testsGreenAfter: boolean;
}

export type RegressionDecision =
  | { readonly action: "no-regression" }
  | { readonly action: "auto-revert"; readonly reason: string }
  | { readonly action: "open-issue-only"; readonly reason: string };

/**
 * Decide what to do post-merge.
 *
 *   - tests red       → auto-revert (highest priority)
 *   - harness drop ≥2 grades → auto-revert
 *   - harness drop  1 grade  → open-issue-only (don't churn revert/replay)
 *   - else           → no-regression
 */
export function decidePostMergeAction(inputs: RegressionInputs): RegressionDecision {
  if (!inputs.testsGreenAfter) {
    return { action: "auto-revert", reason: "CI red after merge" };
  }
  if (inputs.harnessBefore === null || inputs.harnessAfter === null) {
    return { action: "no-regression" };
  }
  const beforeOrd = GRADE_ORDER[inputs.harnessBefore];
  const afterOrd = GRADE_ORDER[inputs.harnessAfter];
  const drop = beforeOrd - afterOrd;
  if (drop >= 2) {
    return { action: "auto-revert", reason: `harness dropped ${drop} grades (${inputs.harnessBefore}→${inputs.harnessAfter})` };
  }
  if (drop === 1) {
    return {
      action: "open-issue-only",
      reason: `harness dropped 1 grade (${inputs.harnessBefore}→${inputs.harnessAfter}) — issue, no revert`,
    };
  }
  return { action: "no-regression" };
}

/**
 * Anti-loop guard: refuse to auto-revert again if the previous
 * auto-revert already targeted the same file. Caller passes the file
 * paths from the suspect commit and the file paths from the prior
 * auto-revert (from lessons-store).
 *
 * Returns `true` when revert is safe to attempt; `false` when the
 * orchestrator must escalate to a human-tagged issue instead.
 */
export function shouldAttemptRevert(
  changedFiles: ReadonlyArray<string>,
  previousAutoRevertFiles: ReadonlyArray<string>,
): boolean {
  if (previousAutoRevertFiles.length === 0) return true;
  const overlap = changedFiles.some((f) => previousAutoRevertFiles.includes(f));
  return !overlap;
}
