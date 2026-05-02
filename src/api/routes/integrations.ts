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
import { getIntegrationsStatus } from "../../core/integrations/tool-status.js";
import { readMemory, readAllMemories, writeMemory, deleteMemory } from "../../core/memory/memory-reader.js";
import { migrateSerenaMemories } from "../../core/memory/memory-migrator.js";
import { buildEnrichedContext } from "../../core/integrations/enriched-context.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { KnowledgeSourceTypeSchema } from "../../schemas/knowledge.schema.js";

/** createIntegrationsRouter — auto-generated description placeholder. */
export function createIntegrationsRouter(storeRef: StoreRef, getBasePath: () => string): Router {
  const router = Router();

  router.get("/status", async (_req, res, next) => {
    try {
      const status = await getIntegrationsStatus(getBasePath());
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  // ── Memories CRUD ────────────────────────────────
  router.get("/memories", async (_req, res, next) => {
    try {
      await migrateSerenaMemories(getBasePath());
      const memories = await readAllMemories(getBasePath());
      res.json(memories);
    } catch (err) {
      next(err);
    }
  });

  router.get("/memories/:name", async (req, res, next) => {
    try {
      const name = req.params.name as string;
      const memory = await readMemory(getBasePath(), name);
      if (!memory) {
        res.status(404).json({ error: `Memory not found: ${name}` });
        return;
      }
      res.json(memory);
    } catch (err) {
      next(err);
    }
  });

  router.post("/memories", async (req, res, next) => {
    try {
      const { name, content } = req.body as { name: string; content: string };
      if (!name || !content) {
        res.status(400).json({ error: "name and content are required" });
        return;
      }
      await writeMemory(getBasePath(), name, content);
      res.status(201).json({ ok: true, name });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/memories/:name", async (req, res, next) => {
    try {
      const name = req.params.name as string;
      const deleted = await deleteMemory(getBasePath(), name);
      if (!deleted) {
        res.status(404).json({ error: `Memory not found: ${name}` });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Backward compat: redirect /serena/memories → /memories
  router.get("/serena/memories", async (_req, res, next) => {
    try {
      await migrateSerenaMemories(getBasePath());
      const memories = await readAllMemories(getBasePath());
      res.json(memories);
    } catch (err) {
      next(err);
    }
  });

  router.get("/serena/memories/:name", async (req, res, next) => {
    try {
      const name = req.params.name as string;
      const memory = await readMemory(getBasePath(), name);
      if (!memory) {
        res.status(404).json({ error: `Memory not found: ${name}` });
        return;
      }
      res.json(memory);
    } catch (err) {
      next(err);
    }
  });

  // ── Enriched context (Memories + Code Intelligence combined) ──
  router.get("/enriched-context/:symbol", async (req, res, next) => {
    try {
      const symbol = req.params.symbol as string;
      const project = storeRef.current.getProject();
      const ctx = await buildEnrichedContext(symbol, getBasePath(), 0, {
        db: storeRef.current.getDb(),
        projectId: project?.id,
      });
      res.json(ctx);
    } catch (err) {
      next(err);
    }
  });

  // ── Knowledge sync status ───────────────────────
  router.get("/knowledge-status", (_req, res, next) => {
    try {
      const knowledgeStore = new KnowledgeStore(storeRef.current.getDb());
      const sourceTypes = KnowledgeSourceTypeSchema.options;
      const statuses = sourceTypes.map((st) => ({
        source: st,
        documentCount: knowledgeStore.count(st),
      }));
      const total = knowledgeStore.count();
      res.json({ total, sources: statuses.filter((s) => s.documentCount > 0) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
