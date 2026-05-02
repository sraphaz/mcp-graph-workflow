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
import { detectCurrentPhase } from "../../core/planner/lifecycle-phase.js";
import { changedFiles, diffForFile } from "../../core/autonomy/git-ops.js";

const DIFF_SNIPPET_MAX_BYTES = 8 * 1024;

/** createAgentsRouter — auto-generated description placeholder. */
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

  // §AgentMonitor — composite payload for the dashboard's agent-detail panel.
  // Mixes the agent's heartbeat row with the current task (lifecycle phase,
  // touched files, diff summary). Diff content is fetched via /diff?path=…
  // so the list view stays small.
  router.get("/:agentId/work", (req, res, next) => {
    try {
      const agentId = req.params["agentId"];
      if (!agentId) {
        res.status(400).json({ error: "agentId_required" });
        return;
      }
      const store = storeRef.current;
      const db = store.getDb();
      const agents = getAgentActivity(db);
      const agent = agents.find((a) => a.agentId === agentId);
      if (!agent) {
        res.status(404).json({ error: "agent_not_found", agentId });
        return;
      }

      const doc = store.toGraphDocument();
      const projectPhase = detectCurrentPhase(doc);

      let currentTask: {
        id: string;
        title: string;
        status: string;
        lifecyclePhase: string;
        startedAt: string | null;
        acceptanceCriteria: ReadonlyArray<{ text: string; done: boolean }>;
      } | null = null;
      if (agent.currentTaskId) {
        const node = doc.nodes.find((n) => n.id === agent.currentTaskId);
        if (node) {
          const md = node.metadata as Record<string, unknown> | undefined;
          const phase = (md?.["lifecyclePhase"] as string | undefined) ?? projectPhase;
          const startedAt = (md?.["_taskStartedAt"] as string | undefined) ?? null;
          // §AgentMonitor — derive AC progress. Each AC string is parsed
          // for a leading checkbox marker (- [x] / [ ] / x: / ✓:); when
          // none is present, fall back to "done" iff the parent task is
          // already done. The dashboard renders this as a checklist.
          const rawAcs = node.acceptanceCriteria ?? [];
          const acceptanceCriteria = rawAcs.map((raw) => {
            const trimmed = raw.trim();
            const checked = /^\s*\[\s*[xX]\s*\]\s*/.test(trimmed) ||
              /^\s*[x✓]\s*[:.-]\s*/.test(trimmed);
            const text = trimmed.replace(/^\s*\[\s*[xX ]\s*\]\s*/, "")
              .replace(/^\s*[x✓-]\s*[:.-]\s*/, "")
              .trim();
            return {
              text: text.length > 0 ? text : trimmed,
              done: checked || node.status === "done",
            };
          });
          currentTask = {
            id: node.id,
            title: node.title,
            status: node.status,
            lifecyclePhase: phase,
            startedAt,
            acceptanceCriteria,
          };
        }
      }

      const files = changedFiles("HEAD");
      res.json({
        agent,
        projectPhase,
        currentTask,
        changedFiles: files,
        changedFileCount: files.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // §AgentMonitor — recent activity timeline for an agent. Reads the
  // event_queue rows authored by `agentId` and returns them newest-first.
  // Caller-controlled limit (default 30, max 200) so a long-running daemon
  // doesn't pull thousands of rows in one request.
  router.get("/:agentId/events", (req, res, next) => {
    try {
      const agentId = req.params["agentId"];
      if (!agentId) {
        res.status(400).json({ error: "agentId_required" });
        return;
      }
      const rawLimit = Number(req.query["limit"]);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 30;
      const db = storeRef.current.getDb();
      let rows: Array<{ id: number; event_type: string; payload: string; created_at: string }>;
      try {
        rows = db
          .prepare(
            `SELECT id, event_type, payload, created_at
               FROM event_queue
              WHERE agent_id = ?
              ORDER BY created_at DESC
              LIMIT ?`,
          )
          .all(agentId, limit) as typeof rows;
      } catch {
        rows = [];
      }
      const events = rows.map((r) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(r.payload);
        } catch {
          parsed = r.payload;
        }
        return {
          id: r.id,
          type: r.event_type,
          createdAt: r.created_at,
          payload: parsed,
        };
      });
      res.json({ agentId, events, limit });
    } catch (err) {
      next(err);
    }
  });

  // Per-file diff fetched on expansion — clamped so a 50k-line refactor
  // diff never blows the response payload.
  router.get("/:agentId/diff", (req, res, next) => {
    try {
      const path = typeof req.query["path"] === "string" ? req.query["path"] : "";
      if (!path) {
        res.status(400).json({ error: "path_required" });
        return;
      }
      const baseRef = typeof req.query["baseRef"] === "string" ? req.query["baseRef"] : "HEAD";
      const fullDiff = diffForFile(path, baseRef);
      const truncated = fullDiff.length > DIFF_SNIPPET_MAX_BYTES;
      const body = truncated ? fullDiff.slice(0, DIFF_SNIPPET_MAX_BYTES) : fullDiff;
      res.json({ path, baseRef, diff: body, truncated, byteCount: fullDiff.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
