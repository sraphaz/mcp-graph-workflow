/**
 * MCP Tool — plugin
 * Manage plugin extensions: install, remove, enable, disable, list, info.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { PluginStore } from "../../core/plugins/plugin-store.js";
import { PluginRegistry } from "../../core/plugins/plugin-registry.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

/* ------------------------------------------------------------------ */
/*  Shared state (module-level registry for MCP process lifetime)      */
/* ------------------------------------------------------------------ */

const registry = new PluginRegistry();

/* ------------------------------------------------------------------ */
/*  Handlers (exported for testing)                                    */
/* ------------------------------------------------------------------ */

interface InstallParams {
  name: string;
  version: string;
  description: string;
  entryPoint: string;
  capabilities: string[];
  path: string;
  config?: Record<string, unknown>;
}

export function handlePluginInstall(
  store: SqliteStore,
  params: InstallParams,
): { ok: boolean; name: string; status: string } {
  const project = store.getActiveProject();
  if (!project) throw new Error("No active project");

  const pluginStore = new PluginStore(store.getDb());
  pluginStore.install({
    projectId: project.id,
    name: params.name,
    version: params.version,
    path: params.path,
    config: params.config,
  });

  logger.info("Plugin installed via MCP", { name: params.name, version: params.version });

  return { ok: true, name: params.name, status: "installed" };
}

export function handlePluginRemove(
  store: SqliteStore,
  params: { name: string },
): { ok: boolean; removed: string } {
  const project = store.getActiveProject();
  if (!project) throw new Error("No active project");

  const pluginStore = new PluginStore(store.getDb());
  pluginStore.remove(project.id, params.name);

  // Also remove from in-memory registry if present
  if (registry.has(params.name)) {
    registry.remove(params.name);
  }

  logger.info("Plugin removed via MCP", { name: params.name });

  return { ok: true, removed: params.name };
}

export function handlePluginEnable(
  store: SqliteStore,
  params: { name: string },
): { ok: boolean; status: string } {
  const project = store.getActiveProject();
  if (!project) throw new Error("No active project");

  const pluginStore = new PluginStore(store.getDb());
  pluginStore.setEnabled(project.id, params.name, true);

  if (registry.has(params.name)) {
    registry.enable(params.name);
  }

  return { ok: true, status: "enabled" };
}

export function handlePluginDisable(
  store: SqliteStore,
  params: { name: string },
): { ok: boolean; status: string } {
  const project = store.getActiveProject();
  if (!project) throw new Error("No active project");

  const pluginStore = new PluginStore(store.getDb());
  pluginStore.setEnabled(project.id, params.name, false);

  if (registry.has(params.name)) {
    registry.disable(params.name);
  }

  return { ok: true, status: "disabled" };
}

export function handlePluginList(
  store: SqliteStore,
): { ok: boolean; plugins: Array<{ name: string; version: string; enabled: boolean; path: string }> } {
  const project = store.getActiveProject();
  if (!project) return { ok: true, plugins: [] };

  const pluginStore = new PluginStore(store.getDb());
  const rows = pluginStore.list(project.id);

  return {
    ok: true,
    plugins: rows.map((r) => ({
      name: r.name,
      version: r.version,
      enabled: r.enabled === 1,
      path: r.path,
    })),
  };
}

export function handlePluginInfo(
  store: SqliteStore,
  params: { name: string },
): { ok: boolean; plugin?: { name: string; version: string; path: string; enabled: boolean; config: Record<string, unknown> | null; installedAt: string } } {
  const project = store.getActiveProject();
  if (!project) return { ok: false };

  const pluginStore = new PluginStore(store.getDb());
  const row = pluginStore.get(project.id, params.name);

  if (!row) return { ok: false };

  return {
    ok: true,
    plugin: {
      name: row.name,
      version: row.version,
      path: row.path,
      enabled: row.enabled === 1,
      config: row.config,
      installedAt: row.installed_at,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  MCP Registration                                                   */
/* ------------------------------------------------------------------ */

export function registerPlugin(server: McpServer, store: SqliteStore): void {
  server.tool(
    "plugin",
    "Manage plugin extensions. Actions: install, remove, enable, disable, list, info.",
    {
      action: z.enum(["install", "remove", "enable", "disable", "list", "info"]).describe("Action to perform"),
      name: z.string().optional().describe("Plugin name (required for install/remove/enable/disable/info)"),
      version: z.string().optional().describe("Plugin version (install)"),
      description: z.string().optional().describe("Plugin description (install)"),
      entryPoint: z.string().optional().describe("Entry point path (install)"),
      capabilities: z.array(z.string()).optional().describe("Plugin capabilities (install)"),
      path: z.string().optional().describe("Plugin directory path (install)"),
    },
    async (params) => {
      try {
        switch (params.action) {
          case "install":
            if (!params.name || !params.version || !params.path) return mcpError("name, version, path required for install");
            return mcpText(handlePluginInstall(store, {
              name: params.name,
              version: params.version,
              description: params.description ?? "",
              entryPoint: params.entryPoint ?? "./index.js",
              capabilities: params.capabilities ?? [],
              path: params.path,
            }));

          case "remove":
            if (!params.name) return mcpError("name required for remove");
            return mcpText(handlePluginRemove(store, { name: params.name }));

          case "enable":
            if (!params.name) return mcpError("name required for enable");
            return mcpText(handlePluginEnable(store, { name: params.name }));

          case "disable":
            if (!params.name) return mcpError("name required for disable");
            return mcpText(handlePluginDisable(store, { name: params.name }));

          case "list":
            return mcpText(handlePluginList(store));

          case "info":
            if (!params.name) return mcpError("name required for info");
            return mcpText(handlePluginInfo(store, { name: params.name }));

          default:
            return mcpError(`Unknown action: ${params.action}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("Plugin tool error", { action: params.action, error: msg });
        return mcpError(msg);
      }
    },
  );
}
