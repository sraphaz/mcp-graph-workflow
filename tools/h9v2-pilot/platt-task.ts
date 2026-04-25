/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * H9v2 pilot task: Platt scaling implementation + tests.
 *
 * Monolithic arm (A, C): single prompt — implement fitPlattParameters + tests.
 * Decomposed arm (B, B-v2): 5 subtasks:
 *   T1 — plattSigmoid function with convention documented
 *   T2 — fitPlattParameters via Newton-Raphson (uses T1's convention)
 *   T3 — plattCalibrate application wrapper (uses T1 + T2)
 *   T4 — 3 unit tests covering plattSigmoid edge cases
 *   T5 — 2 integration tests covering fit + calibrate end-to-end
 */

export interface PilotTask {
  id: string;
  title: string;
  /** Monolithic prompt — single call produces everything. */
  monolithicPrompt: string;
  /** Decomposed subtasks — each emits code that sibling N+1 consumes. */
  subtasks: PilotSubtask[];
}

export interface PilotSubtask {
  id: string;
  title: string;
  /** AC / instructions for this specific subtask. */
  prompt: string;
  /** What deliverables are expected (for parse validation). */
  expectedExports: string[];
  /** ids of siblings this subtask depends_on. */
  dependsOn: string[];
}

export const PLATT_TASK: PilotTask = {
  id: "platt-scaling",
  title: "Platt scaling for probability calibration",
  monolithicPrompt: `You are implementing Platt scaling for calibrating classifier confidence scores.

Write a TypeScript module \`calibration.ts\` that exports:

1. \`plattSigmoid(score: number, A: number, B: number): number\`
   — Returns 1 / (1 + exp(A * score + B))

2. \`fitPlattParameters(scores: number[], labels: number[]): { A: number; B: number }\`
   — Fits A, B via Newton-Raphson (up to 50 iterations, tolerance 1e-4)
   — Labels are 0 or 1. Initial: A=0, B=log((N0+1)/(N1+1)) where N0,N1 are class counts.

3. \`plattCalibrate(score: number, params: { A: number; B: number }): number\`
   — Returns plattSigmoid(score, params.A, params.B)

Also write \`calibration.test.ts\` with vitest imports, containing:
- 3 unit tests for plattSigmoid (x=0 returns 0.5 when A=0,B=0; monotone in score; bounded in [0,1])
- 2 integration tests for fitPlattParameters + plattCalibrate (separable 2-class data; fitted calibrator returns ≈1 for positive side)

Output ONLY the two files as separate code blocks, fenced with \`\`\`ts and preceded by the filename on its own line.`,
  subtasks: [
    {
      id: "T1",
      title: "plattSigmoid with convention documented",
      prompt: `Write a TypeScript file \`calibration.ts\` that exports a function:

\`\`\`ts
export function plattSigmoid(score: number, A: number, B: number): number
\`\`\`

Convention (FIXED, document this in a comment above the function):
  plattSigmoid(x, A, B) = 1 / (1 + exp(A * x + B))

This is the ONLY file for this subtask. Output it as a code block fenced with \`\`\`ts, preceded by the filename on its own line.`,
      expectedExports: ["plattSigmoid"],
      dependsOn: [],
    },
    {
      id: "T2",
      title: "fitPlattParameters via Newton-Raphson",
      prompt: `Extend \`calibration.ts\` to ALSO export:

\`\`\`ts
export function fitPlattParameters(scores: number[], labels: number[]): { A: number; B: number }
\`\`\`

Requirements:
- labels[i] ∈ {0, 1}
- Newton-Raphson, up to 50 iterations, tolerance 1e-4
- Initial: A=0, B = log((N0+1)/(N1+1)) where N0 = count of label=0, N1 = count of label=1
- Uses the SAME plattSigmoid convention from the sibling output above. DO NOT redefine plattSigmoid.

Output the FULL final \`calibration.ts\` including both plattSigmoid and fitPlattParameters. Fence with \`\`\`ts, preceded by the filename.`,
      expectedExports: ["plattSigmoid", "fitPlattParameters"],
      dependsOn: ["T1"],
    },
    {
      id: "T3",
      title: "plattCalibrate application wrapper",
      prompt: `Extend \`calibration.ts\` to ALSO export:

\`\`\`ts
export function plattCalibrate(score: number, params: { A: number; B: number }): number
\`\`\`

Implementation: return plattSigmoid(score, params.A, params.B). Do NOT redefine plattSigmoid. Do NOT redefine fitPlattParameters. Use what siblings produced.

Output the FULL final \`calibration.ts\` with all three exports. Fence with \`\`\`ts, preceded by the filename.`,
      expectedExports: ["plattSigmoid", "fitPlattParameters", "plattCalibrate"],
      dependsOn: ["T1", "T2"],
    },
    {
      id: "T4",
      title: "Unit tests for plattSigmoid",
      prompt: `Write \`calibration.test.ts\` containing EXACTLY 3 unit tests for plattSigmoid:

1. With A=0, B=0, plattSigmoid(x) === 0.5 for any x (substitute x=0, x=1, x=-1 and assert)
2. Monotonicity: plattSigmoid(x1, A, B) < plattSigmoid(x2, A, B) when x1 > x2 and A < 0
3. Bounded: 0 < plattSigmoid(x, A, B) < 1 for any real x, A, B

Use vitest (import { describe, it, expect } from "vitest"). Import plattSigmoid from the sibling output above — do NOT redefine it.

Output the FULL \`calibration.test.ts\`. Fence with \`\`\`ts, preceded by the filename.`,
      expectedExports: [],
      dependsOn: ["T1"],
    },
    {
      id: "T5",
      title: "Integration tests for fit + calibrate",
      prompt: `Extend \`calibration.test.ts\` with TWO additional integration tests (keep the 3 unit tests from the sibling output):

1. Given separable 2-class data ([-5,-4,-3,-2,-1,1,2,3,4,5] with labels [0,0,0,0,0,1,1,1,1,1]), fitPlattParameters returns { A, B } where A < 0 (monotone increasing).
2. Using the fitted params, plattCalibrate(5, params) > 0.9 and plattCalibrate(-5, params) < 0.1.

Keep the single describe/import block from the sibling (do NOT nest describes, do NOT duplicate imports). Output the FULL final \`calibration.test.ts\` with all 5 tests. Fence with \`\`\`ts, preceded by the filename.`,
      expectedExports: [],
      dependsOn: ["T1", "T2", "T3", "T4"],
    },
  ],
};
