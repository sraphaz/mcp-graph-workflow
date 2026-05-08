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
 * MCP Tool — preset
 * Manage workflow presets. Actions: list, apply, show, create.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { BUILT_IN_PRESETS, getPreset } from "../../core/presets/built-in-presets.js";
import { resolvePresets, type ResolvedConfig } from "../../core/presets/preset-resolver.js";
import { PresetSchema, type PresetDefinition } from "../../schemas/preset.schema.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "preset.ts" });

/* ------------------------------------------------------------------ */
/*  Custom presets storage (project settings)                          */
/* ------------------------------------------------------------------ */

const ACTIVE_PRESET_KEY = "active_preset";
const CUSTOM_PRESETS_KEY = "custom_presets";

function getCustomPresets(store: SqliteStore): PresetDefinition[] {
  const raw = store.getProjectSetting(CUSTOM_PRESETS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PresetDefinition[];
  } catch {
    return [];
  }
}

function saveCustomPresets(store: SqliteStore, presets: PresetDefinition[]): void {
  store.setProjectSetting(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
}

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

/** List all available presets (built-in and custom) for the active project. */
export function handlePresetList(
  store: SqliteStore,
): { ok: boolean; presets: Array<{ name: string; description: string; source: string }> } {
  const custom = getCustomPresets(store);

  const presets = [
    ...BUILT_IN_PRESETS.map((p) => ({ name: p.name, description: p.description, source: "built-in" })),
    ...custom.map((p) => ({ name: p.name, description: p.description, source: "custom" })),
  ];

  return { ok: true, presets };
}

/** Apply a named preset as the active workflow configuration. */
export function handlePresetApply(
  store: SqliteStore,
  params: { presetName: string },
): { ok: boolean; applied?: string; error?: string } {
  const builtIn = getPreset(params.presetName);
  const custom = getCustomPresets(store).find((p) => p.name === params.presetName);

  if (!builtIn && !custom) {
    return { ok: false, error: `Preset not found: "${params.presetName}"` };
  }

  store.setProjectSetting(ACTIVE_PRESET_KEY, params.presetName);
  log.info("Preset applied", { preset: params.presetName });

  return { ok: true, applied: params.presetName };
}

/** Show the currently resolved configuration from the active preset. */
export function handlePresetShow(
  store: SqliteStore,
): { ok: boolean; config: ResolvedConfig; activePreset: string | null } {
  const activePreset = store.getProjectSetting(ACTIVE_PRESET_KEY) ?? undefined;

  const config = resolvePresets({
    activePreset,
    pluginPresets: [],
    projectOverrides: {},
  });

  return { ok: true, config, activePreset: activePreset ?? null };
}

/** Create or update a custom preset definition in project settings. */
export function handlePresetCreate(
  store: SqliteStore,
  params: { name: string; description: string; lifecycle?: Record<string, unknown>; dod?: Record<string, unknown>; classifierPatterns?: Record<string, string[]> },
): { ok: boolean; created?: string; error?: string } {
  const presetDef: PresetDefinition = {
    name: params.name,
    description: params.description,
    lifecycle: params.lifecycle as PresetDefinition["lifecycle"],
    dod: params.dod as PresetDefinition["dod"],
    classifierPatterns: params.classifierPatterns,
  };

  const validation = PresetSchema.safeParse(presetDef);
  if (!validation.success) {
    return { ok: false, error: `Invalid preset: ${JSON.stringify(validation.error)}` };
  }

  const custom = getCustomPresets(store);
  const existing = custom.findIndex((p) => p.name === params.name);
  if (existing >= 0) {
    custom[existing] = presetDef;
  } else {
    custom.push(presetDef);
  }
  saveCustomPresets(store, custom);

  log.info("Preset created", { name: params.name });

  return { ok: true, created: params.name };
}

/* ------------------------------------------------------------------ */
/*  MCP Registration                                                   */
/* ------------------------------------------------------------------ */

/** Register the preset MCP tool with list, apply, show, and create actions. */
export function registerPreset(server: McpServer, store: SqliteStore): void {
  server.tool(
    "preset",
    "Manage workflow presets. Actions: list, apply, show, create.",
    {
      action: z.enum(["list", "apply", "show", "create"]).describe("Action to perform"),
      presetName: z.string().optional().describe("Preset name (apply)"),
      name: z.string().optional().describe("New preset name (create)"),
      description: z.string().optional().describe("Preset description (create)"),
      lifecycle: z.record(z.string(), z.unknown()).optional().describe("Lifecycle config (create)"),
      dod: z.record(z.string(), z.unknown()).optional().describe("DoD config (create)"),
      classifierPatterns: z.record(z.string(), z.array(z.string())).optional().describe("Classifier patterns (create)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "list":
            return mcpText(handlePresetList(store));

          case "apply":
            if (!params.presetName) return mcpError("presetName required for apply");
            return mcpText(handlePresetApply(store, { presetName: params.presetName }));

          case "show":
            return mcpText(handlePresetShow(store));

          case "create":
            if (!params.name || !params.description) return mcpError("name and description required for create");
            return mcpText(handlePresetCreate(store, {
              name: params.name,
              description: params.description,
              lifecycle: params.lifecycle,
              dod: params.dod,
              classifierPatterns: params.classifierPatterns,
            }));

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error("Preset tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
