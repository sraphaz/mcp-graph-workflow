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

/**
 * Canonical node type groupings — single source of truth.
 *
 * All modules that need to filter nodes by type category
 * should import from here instead of defining local sets.
 */

/** Task-like types eligible for execution planning */
export const TASK_TYPES: ReadonlySet<string> = new Set(["task", "subtask"]);

/** High-level requirement types */
export const REQUIREMENT_TYPES: ReadonlySet<string> = new Set(["epic", "requirement"]);

/** Design artifact types (decisions, constraints, etc.) */
export const DESIGN_TYPES: ReadonlySet<string> = new Set([
  "decision", "constraint", "risk", "acceptance_criteria",
]);

/** All non-task types used in design phase analysis */
export const DESIGN_ONLY_TYPES: ReadonlySet<string> = new Set([
  "requirement", "epic", "decision", "constraint", "milestone", "risk", "acceptance_criteria",
]);

/** Types relevant for feedback/listening phase */
export const FEEDBACK_TYPES: ReadonlySet<string> = new Set([
  "requirement", "risk", "constraint",
]);
