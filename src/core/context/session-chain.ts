/**
 * Session Chain Manager — parent-child session linking for compression-triggered splitting.
 * Inspired by hermes-agent session chaining with parent_session_id.
 */

import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { SessionRecallStore, type SessionSummary } from "./session-recall.js";

export class SessionChainManager {
  private recallStore: SessionRecallStore;

  constructor(recallStore: SessionRecallStore) {
    this.recallStore = recallStore;
  }

  /**
   * Create a child session linked to a parent.
   * Returns the new session ID.
   */
  createChildSession(parentSessionId: string, reason: string): string {
    const childSessionId = generateId("session");

    this.recallStore.saveSessionSummary({
      sessionId: childSessionId,
      parentSessionId,
      summary: `Child session created from ${parentSessionId} — reason: ${reason}`,
      topics: ["session_chain", reason],
    });

    logger.info("session-chain:created", { parentSessionId, childSessionId, reason });
    return childSessionId;
  }

  /**
   * Get the full lineage from root to the given session.
   * Returns sessions in chronological order (oldest first).
   */
  getSessionLineage(sessionId: string): SessionSummary[] {
    return this.recallStore.getSessionChain(sessionId);
  }
}
