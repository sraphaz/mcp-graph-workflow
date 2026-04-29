/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-13.2 — "Ambiguity Classifier em start_task"
 * Captures the agent's pre-execution self-audit of which AC items are
 * fully specified, partially specified, or unspecified (with the
 * alternatives the agent considered). Persisted in node.metadata.ambiguityAudit.
 */

import { z } from "zod/v4";

export const AmbiguityUnspecifiedSchema = z.object({
  item: z.string().min(1),
  alternatives: z.array(z.string().min(1)).min(1),
});

export const AmbiguityAuditSchema = z.object({
  specified: z.array(z.string()).default([]),
  partial: z.array(z.string()).default([]),
  unspecified: z.array(AmbiguityUnspecifiedSchema).default([]),
});

export type AmbiguityAudit = z.infer<typeof AmbiguityAuditSchema>;

const MIN_AC_FOR_AUDIT_WARNING = 3;

/**
 * Returns true when the task has enough ACs to warrant an explicit
 * ambiguity audit but none was provided.
 */
export function shouldWarnMissingAudit(
  acCount: number,
  audit: AmbiguityAudit | null | undefined,
): boolean {
  if (acCount < MIN_AC_FOR_AUDIT_WARNING) return false;
  return audit == null;
}
