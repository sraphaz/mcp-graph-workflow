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

import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod/v4";
import { ValidationError } from "../../core/utils/errors.js";

export function validateBody(schema: ZodType): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError("Invalid request body", result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError("Invalid query parameters", result.error.issues));
      return;
    }
    next();
  };
}
