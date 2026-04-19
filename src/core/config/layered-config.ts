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
 * 4-Layer Configuration System
 * Priority: defaults → project config → local overrides → environment variables.
 * Each field tracks which layer provided its value.
 */

export interface ConfigField<T> {
  value: T;
  source: "default" | "project" | "local" | "env";
}

export interface LayeredConfigResult {
  port: ConfigField<number>;
  dbPath: ConfigField<string>;
  contextMode: ConfigField<string>;
}

interface ConfigLayer {
  port?: number;
  dbPath?: string;
  contextMode?: string;
}

const DEFAULTS: ConfigLayer = {
  port: 3000,
  dbPath: "workflow-graph",
  contextMode: "lean",
};

export interface ResolveOptions {
  projectConfig?: ConfigLayer;
  localConfig?: ConfigLayer;
  envOverrides?: ConfigLayer;
}

function applyLayer<K extends keyof ConfigLayer>(
  result: Record<K, ConfigField<unknown>>,
  key: K,
  layer: ConfigLayer | undefined,
  source: ConfigField<unknown>["source"],
): void {
  if (layer && layer[key] !== undefined) {
    result[key] = { value: layer[key], source };
  }
}

/** Resolve config by merging defaults, project, local, and env layers. */
export function resolveLayeredConfig(options: ResolveOptions): LayeredConfigResult {
  // Start with defaults
  const result: Record<string, ConfigField<unknown>> = {
    port: { value: DEFAULTS.port ?? 3000, source: "default" },
    dbPath: { value: DEFAULTS.dbPath ?? "workflow-graph", source: "default" },
    contextMode: { value: DEFAULTS.contextMode ?? "lean", source: "default" },
  };

  const fields: Array<keyof ConfigLayer> = ["port", "dbPath", "contextMode"];

  // Layer 2: Project config
  for (const key of fields) {
    applyLayer(result, key, options.projectConfig, "project");
  }

  // Layer 3: Local overrides
  for (const key of fields) {
    applyLayer(result, key, options.localConfig, "local");
  }

  // Layer 4: Environment variables
  for (const key of fields) {
    applyLayer(result, key, options.envOverrides, "env");
  }

  return result as unknown as LayeredConfigResult;
}
