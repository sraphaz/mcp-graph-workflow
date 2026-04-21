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
 * WIP Gate — enforces work-in-progress limits for multi-agent concurrency.
 *
 * Called by start_task before marking a task in_progress.
 * Reads the current in_progress count from the store and either:
 *   - Throws WIPLimitError (wipStrict:true)
 *   - Returns a warning string (wipStrict:false)
 *   - Skips entirely when teamTask is off
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { LockManager } from "../store/lock-manager.js";
import { WIPLimitError, FileConflictError, LockConflictError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface WipGateOptions {
  readonly teamTask: boolean;
  readonly wipLimit: number;
  readonly wipStrict: boolean;
  readonly nodeId: string;
  readonly agentId?: string;
  readonly touchedFiles?: readonly string[];
  readonly lockManager?: LockManager;
}

export interface WipGateResult {
  readonly warning?: string;
  readonly fileLockTokens?: string[];
}

/**
 * Enforce WIP limit gate. Returns WipGateResult (possibly with warning).
 * Throws WIPLimitError in strict mode when the limit is reached.
 * No-op when teamTask is false.
 */
export function enforceWipAndFileGates(
  store: SqliteStore,
  opts: WipGateOptions,
): WipGateResult {
  if (!opts.teamTask) {
    return {};
  }

  const inProgress = store.getNodesByStatus("in_progress");
  const current = inProgress.length;

  if (current >= opts.wipLimit) {
    const inFlightNodeIds = inProgress.map(n => n.id);

    if (opts.wipStrict) {
      throw new WIPLimitError({ current, limit: opts.wipLimit, inFlightNodeIds });
    }

    const warning = `WIP limit advisory: ${current}/${opts.wipLimit} tasks in_progress. ` +
      `Task "${opts.nodeId}" will start but consider finishing existing work first.`;

    logger.warn("wip-gate:advisory", {
      nodeId: opts.nodeId,
      current: String(current),
      limit: String(opts.wipLimit),
    });

    return { warning };
  }

  const fileLockTokens = enforceFileGate(opts);
  return { fileLockTokens: fileLockTokens.length > 0 ? fileLockTokens : undefined };
}

/**
 * Acquire file:* locks for each touchedFile atomically.
 * Rolls back (releases) already-acquired locks on any conflict.
 * Throws FileConflictError with conflictingFiles + heldBy details.
 * Returns empty array when no touchedFiles or no lockManager.
 */
function enforceFileGate(opts: WipGateOptions): string[] {
  const { touchedFiles, lockManager, agentId, nodeId } = opts;

  if (!lockManager || !agentId || !touchedFiles || touchedFiles.length === 0) {
    return [];
  }

  const acquiredTokens: string[] = [];
  const conflictingFiles: string[] = [];
  const heldByMap = new Map<string, string>();

  for (const file of touchedFiles) {
    const resourceId = `file:${file}`;
    try {
      const lock = lockManager.acquire(resourceId, agentId, 600);
      acquiredTokens.push(lock.leaseToken);
    } catch (err) {
      if (err instanceof LockConflictError) {
        conflictingFiles.push(file);
        heldByMap.set(file, err.details.owner);

        // Roll back all already-acquired file locks
        for (const token of acquiredTokens) {
          try { lockManager.release(token); } catch { /* ignore release errors during rollback */ }
        }

        const heldBy = Array.from(heldByMap.entries()).map(([fId, ownerId]) => ({
          nodeId: fId,
          agentId: ownerId,
        }));

        logger.warn("wip-gate:file_conflict", {
          nodeId,
          conflictingFiles: conflictingFiles.join(","),
        });

        throw new FileConflictError({ nodeId, conflictingFiles, heldBy });
      }
      throw err;
    }
  }

  return acquiredTokens;
}
