/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 1.1: Router /api/browser-tests/*
 *
 * GET /runs              — paginated list of harness runs
 * GET /runs/:runId       — single run detail (404 on not found)
 * GET /stream            — SSE stream of harness events
 * GET /runs/:runId/evidence/:stepN — serve PNG screenshot
 */

import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
import { RunsStore } from "../../core/browser-harness/runs-store.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "api", source: "browser-tests.ts" });

function getRunsStore(storeRef: StoreRef, basePath: string): RunsStore {
  return new RunsStore(storeRef.current.getDb(), basePath);
}

export function createBrowserTestsRouter(
  storeRef: StoreRef,
  getBasePath: () => string,
): Router {
  const router = Router();

  router.get("/runs", (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
      const store = getRunsStore(storeRef, getBasePath());
      const runs = store.list(isNaN(limit) ? 50 : limit);
      res.json(runs);
    } catch (err) {
      next(err);
    }
  });

  router.get("/runs/:runId", (req, res, next) => {
    try {
      const store = getRunsStore(storeRef, getBasePath());
      const run = store.get(req.params["runId"]!);
      if (!run) {
        res.status(404).json({ error: `run not found: ${req.params["runId"]}` });
        return;
      }
      res.json(run);
    } catch (err) {
      next(err);
    }
  });

  router.get("/stream", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    const interval = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);
    res.on("close", () => {
      clearInterval(interval);
      log.debug("browser-tests SSE client disconnected");
    });
  });

  router.get("/runs/:runId/evidence/:stepN", (req, res, next) => {
    try {
      const stepN = parseInt(req.params["stepN"]!, 10);
      if (isNaN(stepN) || stepN < 0) {
        res.status(400).json({ error: "stepN must be a non-negative integer" });
        return;
      }
      const store = getRunsStore(storeRef, getBasePath());
      const png = store.loadScreenshot(req.params["runId"]!, stepN);
      if (!png) {
        res.status(404).json({ error: `evidence not found for run ${req.params["runId"]} step ${stepN}` });
        return;
      }
      res.setHeader("Content-Type", "image/png");
      res.send(png);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
