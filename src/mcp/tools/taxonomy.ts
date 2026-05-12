/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Tool taxonomy — single source of truth for which MCP tool belongs to which
 * profile (core / pro / expert). Used by the profile filter in the MCP server
 * registration to control which tools an MCP client sees by default.
 *
 * Profiles (T4.1 of v10.2.0 DX overhaul, see ~/.claude/plans/witty-booping-bunny.md):
 *
 *   core    — Daily work loop. ~8 tools that cover the start_task → finish_task
 *             cycle plus discovery (init, list, help, update_status). Default
 *             surface for new MCP clients to keep cognitive load low.
 *
 *   pro     — Power-user tools for planning, validation, exporting, and finer
 *             graph manipulation. Opt-in via MCP_GRAPH_PROFILE=pro.
 *
 *   expert  — Specialized / experimental / heavy machinery: domain importers
 *             (siebel, davinci), simulation (dream/journey), low-level memory,
 *             pipeline orchestration, code intelligence. Opt-in via
 *             MCP_GRAPH_PROFILE=expert.
 *
 *   all     — Legacy compat (every tool registered). Pass profile="all" or
 *             MCP_GRAPH_PROFILE=all to keep pre-v10.2.0 behavior.
 *
 * The "core" subset is intentionally minimal. New tools default to "expert"
 * — graduating one to "pro" or "core" requires a deliberate plan-level
 * decision so the surface area never accidentally grows.
 */

import { z } from "zod/v4";

export const ToolProfileSchema = z.enum(["core", "pro", "expert"]);
export type ToolProfile = z.infer<typeof ToolProfileSchema>;

export const ProfileFilterSchema = z.enum(["core", "pro", "expert", "all"]);
export type ProfileFilter = z.infer<typeof ProfileFilterSchema>;

/**
 * Canonical mapping from MCP tool name → taxonomy profile.
 *
 * Adding a new MCP tool? You MUST add an entry here. The contract test in
 * src/tests/mcp-tool-taxonomy.test.ts will fail otherwise (so a registered
 * tool without a taxonomy entry can never ship).
 */
export const TOOL_TAXONOMY: Record<string, ToolProfile> = {
  // ----- core (8) — daily work loop -----
  init: "core",
  import_prd: "core",
  next: "core",
  start_task: "core",
  finish_task: "core",
  list: "core",
  help: "core",
  update_status: "core",

  // ----- pro (12) — planning, validation, finer graph ops -----
  analyze: "pro",
  validate: "pro",
  plan_sprint: "pro",
  export: "pro",
  node: "pro",
  edge: "pro",
  kanban: "pro",
  metrics: "pro",
  context: "pro",
  search: "pro",
  show: "pro",
  snapshot: "pro",

  // ----- expert (everything else) — specialized / experimental / heavy -----
  agent_format: "expert",
  browser_harness: "expert",
  clone_node: "expert",
  code_intelligence: "expert",
  constitution: "expert",
  daemon_status: "expert",
  davinci: "expert",
  delegate: "expert",
  evolve: "expert",
  delete_memory: "expert",
  forecast: "expert",
  graph_explore_web: "expert",
  graph_health: "expert",
  graph_lifecycle: "expert",
  graph_materialize: "expert",
  graph_refresh_docs: "expert",
  graph_validate_ui: "expert",
  import_graph: "expert",
  journey: "expert",
  knowledge: "expert",
  list_memories: "expert",
  manage_skill: "expert",
  move_node: "expert",
  pipeline: "expert",
  plugin: "expert",
  preset: "expert",
  query_graph: "expert",
  read_memory: "expert",
  set_phase: "expert",
  siebel: "expert",
  spec: "expert",
  spec_sync: "expert",
  sync_stack_docs: "expert",
  template: "expert",
  translate: "expert",
  write_memory: "expert",
};

/**
 * Returns the taxonomy profile for a tool name, or "expert" as a safe default
 * for tools not yet classified. Logging the unknown case lets us catch missed
 * registrations without breaking the server boot.
 */
export function getToolProfile(toolName: string): ToolProfile {
  return TOOL_TAXONOMY[toolName] ?? "expert";
}

/**
 * Decides whether a tool should be exposed to a client running under the
 * given profile filter. Hierarchy is inclusive: pro sees core+pro, expert
 * sees core+pro+expert, all sees everything (alias of expert here).
 */
export function isToolVisibleForProfile(toolName: string, filter: ProfileFilter): boolean {
  if (filter === "all") return true;
  const profile = getToolProfile(toolName);
  if (filter === "core") return profile === "core";
  if (filter === "pro") return profile === "core" || profile === "pro";
  // filter === "expert"
  return true;
}

/** Returns all tool names that should be visible under the given profile filter. */
export function listToolsForProfile(filter: ProfileFilter): string[] {
  return Object.keys(TOOL_TAXONOMY).filter((name) => isToolVisibleForProfile(name, filter));
}

/** Counts of tools per profile — useful for help/diagnostics output. */
export function profileCounts(): { core: number; pro: number; expert: number; total: number } {
  let core = 0;
  let pro = 0;
  let expert = 0;
  for (const profile of Object.values(TOOL_TAXONOMY)) {
    if (profile === "core") core++;
    else if (profile === "pro") pro++;
    else expert++;
  }
  return { core, pro, expert, total: core + pro + expert };
}
