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

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ConfigSchema, type McpGraphConfig } from "./config-schema.js";
import { McpGraphError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const CONFIG_FILENAME = "mcp-graph.config.json";

/** Load project config from file with env var overrides. */
export function loadConfig(basePath?: string): McpGraphConfig {
  const resolvedBase = basePath ?? process.cwd();
  const configPath = path.join(resolvedBase, CONFIG_FILENAME);

  let fileConfig: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    try {
      // B24 (node_53b5f5463bf5): tolerate UTF-8 BOM prefix; many editors
      // (Notepad on Windows, older VSCode) save JSON with BOM by default.
      const raw = readFileSync(configPath, "utf-8").replace(/^\uFEFF/, "");
      fileConfig = JSON.parse(raw) as Record<string, unknown>;
      logger.info(`Config loaded from ${configPath}`);
    } catch (err) {
      // B23 (node_873b627dab19): malformed JSON used to fall through to
      // defaults silently — users were running with a config that wasn't
      // actually applied. Refuse to boot instead.
      const msg = err instanceof Error ? err.message : String(err);
      throw new McpGraphError(`Invalid config at ${configPath}: ${msg}`);
    }
  } else {
    logger.info("No config file found, using defaults");
  }

  // Env var overrides
  if (process.env.MCP_PORT) {
    const envPort = parseInt(process.env.MCP_PORT, 10);
    if (!isNaN(envPort)) {
      fileConfig.port = envPort;
    }
  }

  if (process.env.CODE_GRAPH_AUTO_INDEX) {
    const integrations = (fileConfig.integrations ?? {}) as Record<string, unknown>;
    integrations.codeGraphAutoIndex = process.env.CODE_GRAPH_AUTO_INDEX !== "false";
    fileConfig.integrations = integrations;
  }

  const config = ConfigSchema.parse(fileConfig);
  return config;
}
