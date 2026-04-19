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
import { LspConfigOverrideSchema } from "../lsp/lsp-types.js";

export const ContextModeSchema = z.enum(["ultra-lean", "lean", "full"]);
export type ContextMode = z.infer<typeof ContextModeSchema>;

export const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  dbPath: z.string().default("workflow-graph"),
  basePath: z.string().optional(),
  contextMode: ContextModeSchema.default("lean"),
  dashboard: z
    .object({
      autoOpen: z.boolean().default(true),
    })
    .default({ autoOpen: true }),
  integrations: z
    .object({
      codeGraphAutoIndex: z.boolean().default(true),
      codeGraphReindexIntervalSec: z.number().int().min(0).default(0),
      lspServers: z.array(LspConfigOverrideSchema).default([]),
    })
    .default({ codeGraphAutoIndex: true, codeGraphReindexIntervalSec: 0, lspServers: [] }),
});

export type McpGraphConfig = z.infer<typeof ConfigSchema>;
