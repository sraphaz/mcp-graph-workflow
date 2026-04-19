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

import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { getAgentActivity } from "../../core/insights/agent-activity.js";

export function createAgentsRouter(storeRef: StoreRef): Router {
  const router = Router();

  router.get("/", (_req, res, next) => {
    try {
      const db = storeRef.current.getDb();
      const agents = getAgentActivity(db);
      res.json({ agents, teamTaskEnabled: agents.length > 0 });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
