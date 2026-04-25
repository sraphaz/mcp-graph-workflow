/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * English translations. This is the canonical dictionary — every other
 * language falls back to a key here if it doesn't define one.
 *
 * Naming convention:
 *   <command>.<purpose>           e.g. init.success, next.startHint
 *   common.<concept>              e.g. common.untitled
 *   error.<kind>                  e.g. error.parentNotInstalled
 */

export const en: Record<string, string> = {
  // Common
  "common.untitled": "(untitled)",
  "common.tryAgain": "try again",
  "common.run": "run",
  "common.next": "next",

  // /init
  "init.success": "✔ mcp-graph initialized",
  "init.projectLabel": "project: ",
  "init.typeLabel": "  ·  type: ",
  "init.ideLabel": "  ·  ide: ",
  "init.ideNone": "(none detected)",
  "init.changesHeader": "changes:",
  "init.nextStepsHeader": "next steps",

  // /next
  "next.title": "NEXT TASK",
  "next.acHeader": "acceptance criteria",
  "next.acMore": "  …+{n} more",
  "next.startHint": "▸ start it: ",
  "next.seeAll": "  ·  see all: ",
  "next.empty":
    "no unblocked tasks. Run `mg list --status backlog` to see what's pending, or `mg add task` to add one.",

  // /list
  "list.header": "tasks  ({shown}/{total} showing)",
  "list.empty": "no tasks match the current filter.",
  "list.startHint": "▸ start one: ",
  "list.filterLabel": "   ·   filter: ",
  "list.moreHint": "…+{n} more — pass --limit {total} to show all",

  // /start
  "start.started": "▶ STARTED",
  "start.inProgress": "▶ IN PROGRESS",
  "start.tddHeader": "TDD checklist",
  "start.tdd1": "write a failing test that captures the AC",
  "start.tdd2": "make it pass with the smallest change",
  "start.tdd3": "refactor; full suite green",
  "start.whenDone": "▸ when done: ",

  // /finish
  "finish.success": "✔ finished",
  "finish.nextHeader": "next up",
  "finish.noMore":
    "no more unblocked tasks. run `mg list` or `mg add task`",

  // /add
  "add.created": "✔ created {type}",
  "add.startHint": "▸ start it: ",

  // /status
  "status.progressLabel": "progress: ",
  "status.inProgressHeader": "in progress ({n})",
  "status.blockedHeader": "⛔ blocked ({n})",
  "status.bridgeLabel": "bridge auth: ",
  "status.bridgeHint": "  (run ",
  "status.graphUnavailable":
    "(graph not available — run `mg init` to bootstrap)",

  // /demo
  "demo.ready": "✔ demo sandbox ready",
  "demo.locationLabel": "location: ",
  "demo.tryHeader": "try this",
  "demo.cleanupHint": "when done: rm -rf {path}   ·   or run mg demo --cleanup",

  // /lang
  "lang.current": "language: {lang}",
  "lang.changed": "✔ language → {lang}",
  "lang.persistedAt": "  saved to {path}",
  "lang.unsupported": "unsupported language: {lang}\n  one of: {supported}",

  // /hooks
  "hooks.installed": "✔ hooks installed  (profile: {profile})",
  "hooks.uninstalled": "✔ hooks uninstalled",
  "hooks.empty":
    "no mcp-graph hooks installed in this project. run `mg hooks install`",

  // /config
  "config.synced": "✔ configs synced  ({ides})",
  "config.inSync": "✔ all configs in sync",
  "config.drift": "⚠ {n} file(s) would change",
  "config.applyHint": "run `mg config sync` to apply",

  // Errors
  "error.parentNotInstalled":
    "@mcp-graph-workflow/mcp-graph runtime not found. run `mg init` first or install it: `npm install -g @mcp-graph-workflow/mcp-graph`",
  "error.bridgeNotFound":
    "Could not locate the GitHub Copilot bridge CLI. Install it: `npm install -g @mcp-graph-workflow/bridge-cli`",
  "error.notInitialized":
    "Graph not initialized. Run `mg init` to bootstrap a project here.",
  "error.unknownCommand": "unknown command: {cmd}",
  "error.didYouMean": "  did you mean: {hits}?",

  // /help shell layout
  "help.tagline": "modern CLI for MCP Graph Workflow",
  "help.usageHeader": "Usage:",
  "help.usage1": "  mg                       # enter REPL with /slash commands",
  "help.usage2": "  mg <command> [args]      # one-shot shell mode",
  "help.commandsHeader": "Commands:",
  "help.replHint":
    "REPL slash equivalents (inside `mg`):  /init  /next  /help  /exit",
  "help.docsHint": "Docs: https://github.com/diegonogueira/mcp-graph-workflow",

  // Command descriptions (mg --help)
  "cmd.help.description": "Show all commands. Pass a query for fuzzy match.",
  "cmd.exit.description": "Leave the REPL (shell mode: no-op).",
  "cmd.version.description": "Print CLI version + project status.",
  "cmd.init.description": "Initialize mcp-graph in this project (interactive wizard).",
  "cmd.demo.description": "Zero-config first-value tour: tmp project + sample PRD + dashboard.",
  "cmd.add.description": "Create a graph node (task, epic, decision, risk, …) — provenance tagged.",
  "cmd.list.description": "List nodes (default: actionable tasks). Filters by status/type/search.",
  "cmd.next.description": "Show the next unblocked task (animated card).",
  "cmd.start.description": "Begin a task: status → in_progress, render TDD checklist + AC.",
  "cmd.finish.description": "Complete the in-progress task: status → done, suggest next.",
  "cmd.login.description": "Authenticate with GitHub Copilot via device flow (or import gh-copilot).",
  "cmd.ui.description": "Launch the dashboard (Express :3000). Wraps the parent's serve command.",
  "cmd.status.description": "1-screen project health: tasks, sprint progress, harness, bridge auth.",
  "cmd.config.description": "Manage IDE/agent configs (sync .mcp.json, .vscode/, .cursor/, .claude/).",
  "cmd.hooks.description": "Install / uninstall / status for Claude Code hooks (zero-intervention workflow).",
  "cmd.log.description": "Query structured logs (~/.mcp-graph/logs/*.jsonl). Filters: --task --hook --trace --since.",
  "cmd.lang.description": "Switch CLI language (English / Portuguese-BR). Toggle, set, or one-shot via --lang.",
  "cmd.harness.description": "Browser harness: list/start/stop/call/cdp/add helpers via the parent's CDP module.",
};
