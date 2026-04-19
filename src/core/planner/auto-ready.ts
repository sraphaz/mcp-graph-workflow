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

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface AutoReadyReport {
  candidates: Array<{
    nodeId: string;
    title: string;
    sprint: string | null;
    reason: string;
  }>;
  totalCandidates: number;
}

/**
 * Identify backlog tasks that meet "ready" criteria:
 * - Has sprint assigned
 * - Has acceptance criteria (at least 1)
 * - All dependencies (depends_on edges) are resolved (done status)
 * - Not blocked
 */
/** Find backlog tasks that meet all "ready" criteria. */
export function analyzeAutoReady(doc: GraphDocument): AutoReadyReport {
  const backlogTasks = doc.nodes.filter(
    (n) =>
      (n.type === "task" || n.type === "subtask") &&
      n.status === "backlog" &&
      !n.blocked,
  );

  const doneIds = new Set(
    doc.nodes.filter((n) => n.status === "done").map((n) => n.id),
  );

  const candidates: AutoReadyReport["candidates"] = [];

  for (const task of backlogTasks) {
    // Must have sprint
    if (!task.sprint) continue;

    // Must have AC
    if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0)
      continue;

    // All dependencies must be done
    const deps = doc.edges.filter(
      (e) => e.from === task.id && e.relationType === "depends_on",
    );
    const allDepsDone = deps.every((e) => doneIds.has(e.to));
    if (!allDepsDone) continue;

    candidates.push({
      nodeId: task.id,
      title: task.title,
      sprint: task.sprint,
      reason:
        deps.length > 0
          ? `Has sprint, ${task.acceptanceCriteria.length} ACs, ${deps.length} deps all done`
          : `Has sprint, ${task.acceptanceCriteria.length} ACs, no blockers`,
    });
  }

  logger.info("auto-ready", { candidates: candidates.length });

  return { candidates, totalCandidates: candidates.length };
}
