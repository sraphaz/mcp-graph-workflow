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
 * §Story-9 — Health API endpoints
 *
 * GET /health       → readiness: runs doctor checks, 200 ok / 503 degraded
 * GET /health/live  → liveness: always 200 when process is responsive
 */

import { Router } from "express";
import { runDoctor } from "../../core/doctor/doctor-runner.js";
import type { DoctorReport } from "../../core/doctor/doctor-types.js";
import { createLogger } from "../../core/utils/logger.js";

export type DoctorFn = (basePath: string) => Promise<DoctorReport>;

const log = createLogger({ layer: "api", source: "health.ts" });

export function createHealthRouter(
  getBasePath: () => string,
  doctorFn: DoctorFn = runDoctor,
): Router {
  const router = Router();

  router.get("/live", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/", (_req, res, next) => {
    doctorFn(getBasePath())
      .then((report) => {
        const status = report.passed ? "ok" : "error";
        res.status(report.passed ? 200 : 503).json({ status, checks: report.checks, summary: report.summary });
      })
      .catch((err: unknown) => {
        log.warn("api:health:readiness_failed", { error: String(err) });
        next(err);
      });
  });

  return router;
}
