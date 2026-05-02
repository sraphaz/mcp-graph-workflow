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
 * MCP Tool — spec_sync
 * Manage spec evolution: sync, status, history, link.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { SpecStore } from "../../core/spec-evolution/spec-store.js";
import { syncSpecToGraph } from "../../core/spec-evolution/sync-engine.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

export function handleSpecSyncSync(
  specStore: SpecStore,
  params: { specId: string; content: string },
): { ok: boolean; changed: boolean; newVersion?: number; message: string } {
  const resultValue = syncSpecToGraph(specStore, params.specId, params.content);
  return { ok: true, changed: resultValue.changed, newVersion: resultValue.newVersion, message: resultValue.message };
}

/** handleSpecSyncStatus — auto-generated description placeholder. */
export function handleSpecSyncStatus(
  specStore: SpecStore,
  params: { specId: string },
): { ok: boolean; status?: string; version?: number; name?: string; links?: number; error?: string } {
  const spec = specStore.get(params.specId);
  if (!spec) return { ok: false, error: `Spec not found: ${params.specId}` };

  const links = specStore.getLinksForSpec(params.specId);

  return {
    ok: true,
    status: "in_sync",
    version: spec.version,
    name: spec.name,
    links: links.length,
  };
}

/** handleSpecSyncHistory — auto-generated description placeholder. */
export function handleSpecSyncHistory(
  specStore: SpecStore,
  params: { specId: string },
): { ok: boolean; currentVersion?: number; versions: Array<{ version: number; diff_summary: string | null; created_at: string }>; error?: string } {
  const spec = specStore.get(params.specId);
  if (!spec) return { ok: false, currentVersion: 0, versions: [], error: `Spec not found: ${params.specId}` };

  const history = specStore.getHistory(params.specId);

  return {
    ok: true,
    currentVersion: spec.version,
    versions: history.map((v) => ({
      version: v.version,
      diff_summary: v.diff_summary,
      created_at: v.created_at,
    })),
  };
}

/** handleSpecSyncLink — auto-generated description placeholder. */
export function handleSpecSyncLink(
  specStore: SpecStore,
  params: { specId: string; nodeId: string; sectionTitle: string; linkType: string },
): { ok: boolean; linked: boolean } {
  specStore.linkNode(params.specId, params.nodeId, params.sectionTitle, params.linkType);
  return { ok: true, linked: true };
}

/* ------------------------------------------------------------------ */
/*  MCP Registration                                                   */
/* ------------------------------------------------------------------ */

export function registerSpecSync(server: McpServer, store: SqliteStore): void {
  server.tool(
    "spec_sync",
    "Manage spec evolution: sync, status, history, link.",
    {
      action: z.enum(["sync", "status", "history", "link"]).describe("Action to perform"),
      specId: z.string().optional().describe("Spec document ID"),
      content: z.string().optional().describe("New content for sync"),
      nodeId: z.string().optional().describe("Node ID for linking"),
      sectionTitle: z.string().optional().describe("Section title for linking"),
      linkType: z.enum(["derived_from", "implements", "validates"]).optional().describe("Link type"),
    },
    async (params) => {
      try {
        const specStore = new SpecStore(store.getDb());

        switch (params.action) {
          case "sync":
            if (!params.specId || !params.content) return mcpError("specId and content required for sync");
            return mcpText(handleSpecSyncSync(specStore, { specId: params.specId, content: params.content }));

          case "status":
            if (!params.specId) return mcpError("specId required for status");
            return mcpText(handleSpecSyncStatus(specStore, { specId: params.specId }));

          case "history":
            if (!params.specId) return mcpError("specId required for history");
            return mcpText(handleSpecSyncHistory(specStore, { specId: params.specId }));

          case "link":
            if (!params.specId || !params.nodeId || !params.sectionTitle) return mcpError("specId, nodeId, sectionTitle required for link");
            return mcpText(handleSpecSyncLink(specStore, {
              specId: params.specId,
              nodeId: params.nodeId,
              sectionTitle: params.sectionTitle,
              linkType: params.linkType ?? "derived_from",
            }));

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Spec sync tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
