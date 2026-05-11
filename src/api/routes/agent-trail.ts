/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §node_3ac439cce368 — Task 1.2: GET /api/agent/trail?session=...&limit=N
 */

import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { getEventsBySession } from "../../core/event-store/query.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

/** createAgentTrailRouter — returns the last N events for a session. */
export function createAgentTrailRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/trail", (req, res, next) => {
    try {
      const session = req.query["session"];
      if (typeof session !== "string" || session.length === 0) {
        res.status(400).json({ error: "session_required" });
        return;
      }

      const rawLimit = parseInt(String(req.query["limit"] ?? ""), 10);
      const limit = isNaN(rawLimit) || rawLimit <= 0
        ? DEFAULT_LIMIT
        : Math.min(rawLimit, MAX_LIMIT);

      const db = storeRef.current.getDb();
      const events = getEventsBySession(db, session, limit);
      res.json({ events });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
