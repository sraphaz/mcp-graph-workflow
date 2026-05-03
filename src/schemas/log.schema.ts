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

import { z } from "zod/v4";

export const LogLevelSchema = z.enum(["info", "warn", "error", "success", "debug"]);

export const LogLayerSchema = z.enum(["core", "api", "mcp", "rag", "web", "cli"]);

export const LogEntrySchema = z.object({
  id: z.number().int(),
  level: LogLevelSchema,
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
  layer: LogLayerSchema.optional(),
});

export type LogLevel = z.infer<typeof LogLevelSchema>;
export type LogLayer = z.infer<typeof LogLayerSchema>;
export type LogEntry = z.infer<typeof LogEntrySchema>;
