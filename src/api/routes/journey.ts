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
import path from "node:path";
import fs from "node:fs";
import { z } from "zod/v4";
import type { StoreRef } from "../../core/store/store-manager.js";
import { JourneyStore } from "../../core/journey/journey-store.js";
import { validateBody } from "../middleware/validate.js";
import { GraphNotInitializedError } from "../../core/utils/errors.js";
import { STORE_DIR } from "../../core/utils/constants.js";

const JOURNEY_SCREENSHOTS_DIR = "journey-screenshots";
const ID_MAX = 100;
const TITLE_MAX = 500;
const TEXT_MAX = 10_000;
const URL_MAX = 2000;
const ARRAY_MAX = 1000;

const CreateMapSchema = z.object({
  name: z.string().min(1).max(TITLE_MAX),
  url: z.string().max(URL_MAX).optional(),
  description: z.string().max(TEXT_MAX).optional(),
}).strict();

const JourneyFieldSchema = z.object({
  name: z.string().max(TITLE_MAX),
  type: z.string().max(ID_MAX),
  required: z.boolean().optional(),
  label: z.string().max(TITLE_MAX).optional(),
  options: z.array(z.string().max(TITLE_MAX)).max(ARRAY_MAX).optional(),
}).strict();

const CreateScreenSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX),
  description: z.string().max(TEXT_MAX).optional(),
  screenshot: z.string().max(URL_MAX).optional(),
  url: z.string().max(URL_MAX).optional(),
  screenType: z.string().max(ID_MAX).optional(),
  fields: z.array(JourneyFieldSchema).max(ARRAY_MAX).optional(),
  ctas: z.array(z.string().max(TITLE_MAX)).max(ARRAY_MAX).optional(),
  metadata: z.record(z.string().max(ID_MAX), z.unknown()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
}).strict();

const CreateEdgeSchema = z.object({
  from: z.string().min(1).max(ID_MAX),
  to: z.string().min(1).max(ID_MAX),
  label: z.string().max(TITLE_MAX).optional(),
  type: z.string().max(ID_MAX).optional(),
}).strict();

export const UpdateScreenSchema = z.object({
  title: z.string().min(1).max(TITLE_MAX).optional(),
  description: z.string().max(TEXT_MAX).optional(),
  screenshot: z.string().max(URL_MAX).optional(),
  url: z.string().max(URL_MAX).optional(),
  screenType: z.string().max(ID_MAX).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  fields: z.array(z.record(z.string().max(ID_MAX), z.unknown())).max(ARRAY_MAX).optional(),
  ctaButtons: z.array(z.record(z.string().max(ID_MAX), z.unknown())).max(ARRAY_MAX).optional(),
  abVariants: z.array(z.record(z.string().max(ID_MAX), z.unknown())).max(ARRAY_MAX).optional(),
}).strict();

const ImportJourneySchema = z.object({
  journey: CreateMapSchema,
  screens: z.array(z.object({
    id: z.string().max(ID_MAX).optional(),
    ...CreateScreenSchema.shape,
  }).strict()).max(ARRAY_MAX),
  edges: z.array(CreateEdgeSchema).max(ARRAY_MAX),
  variants: z.record(z.string(), z.object({
    name: z.string().max(TITLE_MAX),
    description: z.string().max(TEXT_MAX).optional(),
    path: z.array(z.string().max(ID_MAX)).max(ARRAY_MAX),
  }).strict()).optional(),
}).strict();

function getJourneyStore(storeRef: StoreRef): JourneyStore {
  const store = storeRef.current;
  const project = store.getProject();
  if (!project) throw new GraphNotInitializedError();
  return new JourneyStore(store.getDb(), project.id);
}

export function createJourneyRouter(storeRef: StoreRef, getBasePath: () => string): Router {
  const router = Router();

  // ── List all journey maps ─────────────────────────

  router.get("/maps", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const maps = journeyStore.listMaps();
      res.json({ maps });
    } catch (err) {
      next(err);
    }
  });

  // ── Create a journey map ──────────────────────────

  router.post("/maps", validateBody(CreateMapSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const input = req.body as z.infer<typeof CreateMapSchema>;
      const map = journeyStore.createMap(input);
      res.status(201).json(map);
    } catch (err) {
      next(err);
    }
  });

  // ── Get a journey map with screens and edges ──────

  router.get("/maps/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const map = journeyStore.getMap(req.params.id as string);
      if (!map) {
        res.status(404).json({ error: "Journey map not found" });
        return;
      }
      res.json(map);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete a journey map ──────────────────────────

  router.delete("/maps/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const deleted = journeyStore.deleteMap(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ error: "Journey map not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ── Add a screen to a map ─────────────────────────

  router.post("/maps/:id/screens", validateBody(CreateScreenSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const input = req.body as z.infer<typeof CreateScreenSchema>;
      const screen = journeyStore.addScreen(req.params.id as string, input);
      res.status(201).json(screen);
    } catch (err) {
      next(err);
    }
  });

  // ── Update a screen ───────────────────────────────

  router.patch("/screens/:id", validateBody(UpdateScreenSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const updated = journeyStore.updateScreen(req.params.id as string, req.body as z.infer<typeof UpdateScreenSchema>);
      if (!updated) {
        res.status(404).json({ error: "Screen not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete a screen ───────────────────────────────

  router.delete("/screens/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const deleted = journeyStore.deleteScreen(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ error: "Screen not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ── Add an edge between screens ───────────────────

  router.post("/maps/:id/edges", validateBody(CreateEdgeSchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const input = req.body as z.infer<typeof CreateEdgeSchema>;
      const edge = journeyStore.addEdge(req.params.id as string, input);
      res.status(201).json(edge);
    } catch (err) {
      next(err);
    }
  });

  // ── Delete an edge ────────────────────────────────

  router.delete("/edges/:id", (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const deleted = journeyStore.deleteEdge(req.params.id as string);
      if (!deleted) {
        res.status(404).json({ error: "Edge not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // ── Import a full journey map from JSON ───────────

  router.post("/maps/import", validateBody(ImportJourneySchema), (req, res, next) => {
    try {
      const journeyStore = getJourneyStore(storeRef);
      const data = req.body as z.infer<typeof ImportJourneySchema>;
      const result = journeyStore.importJourneyMap(data);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Serve screenshots ─────────────────────────────

  router.get("/screenshots/:mapId/:filename", (req, res, next) => {
    try {
      const filename = req.params.filename as string;
      // Prevent path traversal
      const safeName = path.basename(filename);
      if (safeName !== filename || filename.includes("..")) {
        res.status(400).json({ error: "Invalid filename" });
        return;
      }

      const basePath = getBasePath();
      const screenshotPath = path.join(basePath, STORE_DIR, JOURNEY_SCREENSHOTS_DIR, safeName);

      if (!fs.existsSync(screenshotPath)) {
        res.status(404).json({ error: "Screenshot not found" });
        return;
      }

      res.sendFile(screenshotPath);
    } catch (err) {
      next(err);
    }
  });

  // ── List available screenshots ────────────────────

  router.get("/screenshots", (req, res, next) => {
    try {
      const basePath = getBasePath();
      const dir = path.join(basePath, STORE_DIR, JOURNEY_SCREENSHOTS_DIR);

      if (!fs.existsSync(dir)) {
        res.json({ files: [] });
        return;
      }

      const files = fs.readdirSync(dir)
        .filter((f) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))
        .map((f) => ({
          name: f,
          size: fs.statSync(path.join(dir, f)).size,
          url: `/api/v1/journey/screenshots/_/${f}`,
        }));

      res.json({ files });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
