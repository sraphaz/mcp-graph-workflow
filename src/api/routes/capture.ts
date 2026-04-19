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
import { validateBody } from "../middleware/validate.js";
import { captureWebPage } from "../../core/capture/web-capture.js";
import { logger } from "../../core/utils/logger.js";

const CaptureRequestSchema = z.object({
  url: z.url("url must be a valid URL").max(2000),
  selector: z.string().max(500).optional(),
  timeout: z.number().int().positive().max(60_000).optional(),
  waitForSelector: z.string().max(500).optional(),
}).strict();

export function createCaptureRouter(): Router {
  const router = Router();

  /**
   * POST /capture
   * Capture a web page and extract structured content.
   */
  router.post("/", validateBody(CaptureRequestSchema), async (req, res, next) => {
    try {
      const { url, selector, timeout, waitForSelector } = req.body as z.infer<typeof CaptureRequestSchema>;

      logger.info("Capture request received", { url, selector });

      const result = await captureWebPage(url, { selector, timeout, waitForSelector });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
