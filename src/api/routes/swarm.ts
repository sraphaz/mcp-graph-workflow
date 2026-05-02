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
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { SwarmCoordinator } from "../../core/swarm/swarm-coordinator.js";
import { JudgeMonitor } from "../../core/swarm/judge-monitor.js";
import { SwarmConfigSchema } from "../../core/swarm/swarm-types.js";
import { validateBody } from "../middleware/validate.js";
import { McpGraphError } from "../../core/utils/errors.js";

const ScaleBodySchema = z.object({ maxAgents: z.number().int().min(1).max(32) });

/** createSwarmRouter — auto-generated description placeholder. */
export function createSwarmRouter(storeRef: StoreRef): Router {
  const router = Router();

  function coordinator(): SwarmCoordinator {
    return new SwarmCoordinator(storeRef.current.getDb());
  }

  function judge(): JudgeMonitor {
    return new JudgeMonitor(storeRef.current.getDb());
  }

  // POST /sessions — create + initialize a new swarm session
  router.post("/sessions", validateBody(SwarmConfigSchema), (req, res, next) => {
    try {
      const config = req.body as z.infer<typeof SwarmConfigSchema>;
      const session = coordinator().init(config);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  });

  // GET /sessions — list all sessions
  router.get("/sessions", (_req, res, next) => {
    try {
      const db = storeRef.current.getDb();
      const rows = db
        .prepare("SELECT id, topology, consensus, status, max_agents, strategy, created_at, updated_at FROM swarm_sessions ORDER BY created_at DESC LIMIT 100")
        .all() as Array<Record<string, unknown>>;
      const sessions = rows.map((r) => ({
        id: r["id"],
        topology: r["topology"],
        consensus: r["consensus"],
        status: r["status"],
        maxAgents: r["max_agents"],
        strategy: r["strategy"],
        createdAt: r["created_at"],
        updatedAt: r["updated_at"],
      }));
      res.json({ sessions });
    } catch (err) {
      next(err);
    }
  });

  // GET /sessions/:id — get session status
  router.get("/sessions/:id", (req, res, next) => {
    try {
      const session = coordinator().status(req.params["id"] ?? "");
      res.json(session);
    } catch (err) {
      if (err instanceof McpGraphError) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // POST /sessions/:id/start — transition session to active
  router.post("/sessions/:id/start", (req, res, next) => {
    try {
      const session = coordinator().start(req.params["id"] ?? "");
      res.json(session);
    } catch (err) {
      if (err instanceof McpGraphError) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // POST /sessions/:id/stop — transition session to stopped
  router.post("/sessions/:id/stop", (req, res, next) => {
    try {
      const session = coordinator().stop(req.params["id"] ?? "");
      res.json(session);
    } catch (err) {
      if (err instanceof McpGraphError) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // POST /sessions/:id/scale — update maxAgents
  router.post("/sessions/:id/scale", validateBody(ScaleBodySchema), (req, res, next) => {
    try {
      const { maxAgents } = req.body as z.infer<typeof ScaleBodySchema>;
      const session = coordinator().scale(String(req.params["id"] ?? ""), maxAgents);
      res.json(session);
    } catch (err) {
      if (err instanceof McpGraphError) {
        res.status(404).json({ error: err.message });
        return;
      }
      next(err);
    }
  });

  // GET /sessions/:id/health — JudgeMonitor on-demand health check
  router.get("/sessions/:id/health", (req, res, next) => {
    try {
      const resultValue = judge().checkHealth(req.params["id"] ?? "");
      const statusCode = resultValue.status === "not_found" ? 404 : 200;
      res.status(statusCode).json(resultValue);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
