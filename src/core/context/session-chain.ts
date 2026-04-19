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
