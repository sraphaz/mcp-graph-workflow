/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * EPIC 18 — Evals + Golden Dataset.
 * proposeAsGolden — helper for `finish_task({ proposeAsGolden: true })`.
 * Persists (input, output) of a finished task as a candidate golden
 * (tagged "candidate") so a human can promote it later via GoldenStore.update.
 */

import type { GoldenStore, GoldenEntry } from "../store/golden-store.js";

export interface ProposeAsGoldenInput {
  input: string;
  output: string;
  tool: string;
  projectId: string;
  scorerKind?: string;
  nodeId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/** proposeAsGolden — auto-generated description placeholder. */
export function proposeAsGolden(
  store: GoldenStore,
  input: ProposeAsGoldenInput,
): GoldenEntry {
  const baseTags = input.tags ?? [];
  const tags = baseTags.includes("candidate") ? baseTags : [...baseTags, "candidate"];
  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    proposed: true,
  };
  if (input.nodeId) metadata.nodeId = input.nodeId;

  return store.create({
    input: input.input,
    expected: input.output,
    scorerKind: input.scorerKind ?? "exact",
    tool: input.tool,
    projectId: input.projectId,
    metadata,
    tags,
  });
}
