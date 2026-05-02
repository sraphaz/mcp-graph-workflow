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

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { wrapToolsWithGates } from "../unified-gate.js";
import { LockManager } from "../../core/store/lock-manager.js";
import { logger } from "../../core/utils/logger.js";
import { isToolVisibleForProfile, type ProfileFilter } from "./taxonomy.js";

// T2.5 — Lazy MCP tool imports.
//
// Static imports of every tool module forced cold-boot to evaluate ALL of
// them even when the active profile only registers a handful (e.g.
// profile=core registers 8 of 49 classified tools). Dynamic `await
// import()` inside each profile gate defers module evaluation until the
// gate passes; profile=core boots without ever loading siebel/davinci/
// forecast/etc. Bundlers preserve dynamic-import semantics; with tsup
// splitting=false the modules end up in the bundle but evaluation is
// still deferred — RAM/time savings come from the deferred top-level
// side-effects (logger registration, regex compilation, schema parsing).

/** registerAllTools — auto-generated description placeholder. */
export async function registerAllTools(
  server: McpServer,
  store: SqliteStore,
  profile: ProfileFilter = "all",
): Promise<void> {
  // Initialize LockManager when teamTask mode is enabled
  let lockManager: LockManager | undefined;
  try {
    const teamTaskMode = store.getProjectSetting("team_task_mode");
    if (teamTaskMode === "on") {
      lockManager = new LockManager(store.getDb());
      logger.info("tools:teamTask:enabled", { lockManager: true });
    }
  } catch {
    // Project may not be initialized yet — no team task mode
  }

  const visible = (toolName: string): boolean =>
    isToolVisibleForProfile(toolName, profile);

  if (visible("init")) (await import("./init.js")).registerInit(server, store);
  if (visible("import_prd")) (await import("./import-prd.js")).registerImportPrd(server, store);
  if (visible("list")) (await import("./list.js")).registerList(server, store);
  if (visible("show")) (await import("./show.js")).registerShow(server, store);
  if (visible("next")) (await import("./next.js")).registerNext(server, store, lockManager);
  if (visible("update_status")) (await import("./update-status.js")).registerUpdateStatus(server, store);
  if (visible("metrics")) (await import("./metrics.js")).registerMetrics(server, store);
  if (visible("context")) (await import("./context.js")).registerContext(server, store);
  if (visible("search")) (await import("./search.js")).registerSearch(server, store);
  if (visible("analyze")) (await import("./analyze.js")).registerAnalyze(server, store);
  if (visible("evolve")) (await import("./evolve.js")).registerEvolve(server, store);
  if (visible("graph_lifecycle")) (await import("./graph-lifecycle.js")).registerGraphLifecycle(server, store);
  if (visible("graph_materialize")) (await import("./graph-materialize.js")).registerGraphMaterialize(server, store);
  if (visible("graph_validate_ui")) (await import("./graph-validate-ui.js")).registerGraphValidateUi(server);
  if (visible("graph_explore_web")) (await import("./graph-explore-web.js")).registerGraphExploreWeb(server);
  if (visible("graph_refresh_docs")) (await import("./graph-refresh-docs.js")).registerGraphRefreshDocs(server, store);
  if (visible("edge")) (await import("./edge.js")).registerEdge(server, store);
  if (visible("snapshot")) (await import("./snapshot.js")).registerSnapshot(server, store);
  if (visible("export")) (await import("./export.js")).registerExport(server, store);
  if (visible("import_graph")) (await import("./import-graph.js")).registerImportGraph(server, store);
  if (visible("move_node")) (await import("./move-node.js")).registerMoveNode(server, store);
  if (visible("clone_node")) (await import("./clone-node.js")).registerCloneNode(server, store);
  if (visible("sync_stack_docs")) (await import("./sync-stack-docs.js")).registerSyncStackDocs(server, store);
  if (visible("plan_sprint")) (await import("./plan-sprint.js")).registerPlanSprint(server, store);
  if (visible("set_phase")) (await import("./set-phase.js")).registerSetPhase(server, store);
  if (visible("write_memory") || visible("read_memory") || visible("list_memories") || visible("delete_memory")) {
    // memory tool registers 4 names; gate on the union — if any visible, load the module once
    (await import("./memory.js")).registerMemory(server, store);
  }
  if (visible("manage_skill")) (await import("./manage-skill.js")).registerManageSkill(server, store);
  if (visible("journey")) (await import("./journey.js")).registerJourney(server, store);
  if (visible("help")) (await import("./help.js")).registerHelp(server);
  // Consolidated tools (v8.0)
  if (visible("siebel")) (await import("./siebel.js")).registerSiebel(server, store);
  if (visible("knowledge")) (await import("./knowledge.js")).registerKnowledge(server, store);
  if (visible("davinci")) (await import("./davinci.js")).registerDavinci(server, store);
  if (visible("translate")) (await import("./translate.js")).registerTranslate(server, store);
  if (visible("node")) (await import("./node.js")).registerNode(server, store);
  if (visible("validate")) (await import("./validate.js")).registerValidate(server, store);
  if (visible("template")) (await import("./template.js")).registerTemplate(server, store);
  if (visible("code_intelligence")) (await import("./code-intelligence.js")).registerCodeIntelligence(server, store);
  if (visible("start_task")) (await import("./start-task.js")).registerStartTask(server, store, lockManager);
  if (visible("finish_task")) (await import("./finish-task.js")).registerFinishTask(server, store, lockManager);
  if (visible("forecast")) (await import("./forecast.js")).registerForecast(server, store);
  if (visible("kanban")) (await import("./kanban.js")).registerKanban(server, store);
  if (visible("graph_health")) (await import("./graph-health.js")).registerGraphHealth(server, store);
  if (visible("constitution")) (await import("./constitution.js")).registerConstitution(server, store);
  if (visible("plugin")) (await import("./plugin.js")).registerPlugin(server, store);
  if (visible("preset")) (await import("./preset.js")).registerPreset(server, store);
  if (visible("spec")) (await import("./spec.js")).registerSpec(server, store);
  if (visible("spec_sync")) (await import("./spec-sync.js")).registerSpecSync(server, store);
  if (visible("agent_format")) (await import("./agent-format.js")).registerAgentFormat(server, store);
  if (visible("feature_depth")) (await import("./feature-depth.js")).registerFeatureDepth(server, store);
  if (visible("delegate")) (await import("./delegate.js")).registerDelegate(server, store);
  if (visible("pipeline")) (await import("./pipeline.js")).registerPipeline(server, store);
  if (visible("daemon_status")) (await import("./daemon-status.js")).registerDaemonStatus(server);
  if (visible("browser_harness")) (await import("./browser-harness.js")).registerBrowserHarnessTool(server, store);
  if (visible("browser_pilot_run")) (await import("./browser-pilot.js")).registerBrowserPilotTool(server, store);
  if (visible("query_graph")) (await import("./query-graph.js")).registerQueryGraph(server, store);
  wrapToolsWithGates(server, store);
}
