/**
 * Checks if all sibling tasks under a parent are done,
 * suggesting promotion of the parent (epic) to done.
 * Extracted from update-status.ts for reuse in finish-task.ts.
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import { logger } from "./logger.js";

export interface EpicPromotionResult {
  parentId: string;
  parentTitle: string;
  childrenDone: number;
  suggestion: string;
}

/**
 * Check if all children of a node's parent are done.
 * Returns a promotion suggestion if so, null otherwise.
 */
export function checkEpicPromotion(
  store: SqliteStore,
  nodeId: string,
): EpicPromotionResult | null {
  try {
    const node = store.getNodeById(nodeId);
    if (!node?.parentId) return null;

    const siblings = store.getChildNodes(node.parentId);
    const allDone = siblings.length > 0 && siblings.every((s) => s.status === "done");
    if (!allDone) return null;

    const parent = store.getNodeById(node.parentId);
    if (!parent || parent.status === "done") return null;

    return {
      parentId: parent.id,
      parentTitle: parent.title,
      childrenDone: siblings.length,
      suggestion: `Todas as ${siblings.length} tasks filhas estão done. Considere marcar "${parent.title}" (${parent.id}) como done.`,
    };
  } catch (err) {
    logger.debug("epic-promotion:check_failed", { error: String(err) });
    return null;
  }
}
