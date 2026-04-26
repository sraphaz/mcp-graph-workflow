/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Built-in command catalogue. Every v11 command lands here as a single
 * `registerCommand({...})` entry. Handlers are kept lightweight — heavy
 * imports done inside the handler body (lazy) to keep cold start fast.
 */

import { registerCommand } from "./registry.js";

let registered = false;

export function registerBuiltinCommands(): void {
  if (registered) return;
  registered = true;

  registerCommand({
    id: "help",
    name: "help",
    description: "Show all commands. Pass a query for fuzzy match.",
    usage: "/help [query]   ·   mcp-graph help [query]",
    slashAliases: ["help", "?"],
    shellAliases: ["help"],
    category: "meta",
    examples: ["/help", "/help next", "mcp-graph help harness"],
    handler: async (ctx) => {
      const { renderHelp } = await import("./help.js");
      return renderHelp(ctx);
    },
  });

  registerCommand({
    id: "exit",
    name: "exit",
    description: "Leave the REPL (shell mode: no-op).",
    usage: "/exit   ·   /quit",
    slashAliases: ["exit", "quit", "q"],
    shellAliases: [],
    category: "meta",
    handler: async () => ({ exitCode: 0, text: "bye 👋" }),
  });

  registerCommand({
    id: "version",
    name: "version",
    description: "Print CLI version + project status.",
    usage: "/version   ·   mcp-graph --version",
    slashAliases: ["version", "v"],
    shellAliases: ["version", "--version", "-v"],
    category: "meta",
    handler: async () => {
      const pkg = await import("../meta.js");
      return { exitCode: 0, text: `mcp-graph-cli v${pkg.VERSION}` };
    },
  });

  registerCommand({
    id: "init",
    name: "init",
    description: "Initialize mcp-graph in this project (interactive wizard).",
    usage: "/init [--non-interactive]   ·   mcp-graph init",
    slashAliases: ["init"],
    shellAliases: ["init"],
    category: "lifecycle",
    emitSkill: true,
    examples: ["/init", "mcp-graph init --non-interactive"],
    handler: async (ctx) => {
      const { runInit } = await import("./init.js");
      return runInit(ctx);
    },
  });

  registerCommand({
    id: "login",
    name: "login",
    description:
      "Authenticate with GitHub Copilot via device flow (or import gh-copilot).",
    usage: "/login [--fresh]   ·   mcp-graph login",
    slashAliases: ["login"],
    shellAliases: ["login"],
    category: "auth",
    emitSkill: true,
    examples: ["/login", "mcp-graph login --fresh"],
    handler: async (ctx) => {
      const { runLogin } = await import("./login.js");
      return runLogin(ctx);
    },
  });

  registerCommand({
    id: "demo",
    name: "demo",
    description:
      "Zero-config first-value tour: tmp project + sample PRD + dashboard.",
    usage: "/demo   ·   mcp-graph demo",
    slashAliases: ["demo"],
    shellAliases: ["demo"],
    category: "lifecycle",
    emitSkill: true,
    handler: async (ctx) => {
      const { runDemo } = await import("./demo.js");
      return runDemo(ctx);
    },
  });

  registerCommand({
    id: "log",
    name: "log",
    description:
      "Query structured logs (~/.mcp-graph/logs/*.jsonl). Filters: --task --hook --trace --since.",
    usage: "/log [filters]   ·   mcp-graph log",
    slashAliases: ["log"],
    shellAliases: ["log"],
    category: "ops",
    examples: [
      "/log",
      "mcp-graph log --hook post-edit --since 1h",
      "mcp-graph log --task node_799f48ee8dfb",
      "mcp-graph log --json | jq",
    ],
    handler: async (ctx) => {
      const { runLog } = await import("./log.js");
      return runLog(ctx);
    },
  });

  registerCommand({
    id: "hooks",
    name: "hooks",
    description:
      "Install / uninstall / status for Claude Code hooks (zero-intervention workflow).",
    usage:
      "/hooks <install|uninstall|status> [--profile minimal|balanced|aggressive]",
    slashAliases: ["hooks"],
    shellAliases: ["hooks"],
    category: "ops",
    examples: [
      "/hooks install",
      "mcp-graph hooks install --profile aggressive",
      "mcp-graph hooks status",
      "mcp-graph hooks uninstall",
    ],
    handler: async (ctx) => {
      const { runHooks } = await import("./hooks.js");
      return runHooks(ctx);
    },
  });

  registerCommand({
    id: "hook",
    name: "hook",
    description:
      "(internal) Dispatcher invoked by Claude Code hook entries. Non-blocking, fail-silent.",
    usage: "mcp-graph hook <name>",
    slashAliases: [],
    shellAliases: ["hook"],
    category: "internal",
    hidden: true,
    handler: async (ctx) => {
      const { runHookDispatch } = await import("./hook-dispatch.js");
      return runHookDispatch(ctx);
    },
  });

  registerCommand({
    id: "lang",
    name: "lang",
    description:
      "Switch CLI language (English / Portuguese-BR). Toggle, set, or one-shot via --lang.",
    usage:
      "/lang [toggle|en|pt-br]   ·   mcp-graph lang [toggle|<code>]   ·   --lang <code> on any cmd",
    slashAliases: ["lang"],
    shellAliases: ["lang"],
    category: "ops",
    examples: ["/lang", "mcp-graph lang toggle", "mcp-graph lang pt-br", "mcp-graph next --lang en"],
    handler: async (ctx) => {
      const { runLang } = await import("./lang.js");
      return runLang(ctx);
    },
  });

  registerCommand({
    id: "config",
    name: "config",
    description: "Manage IDE/agent configs (sync .mcp.json, .vscode/, .cursor/, .claude/).",
    usage: "/config <sync|check> [--force]   ·   mcp-graph config <action>",
    slashAliases: ["config"],
    shellAliases: ["config"],
    category: "ops",
    examples: ["/config sync", "mcp-graph config check", "mcp-graph config sync --force"],
    handler: async (ctx) => {
      const { runConfig } = await import("./config.js");
      return runConfig(ctx);
    },
  });

  registerCommand({
    id: "add",
    name: "add",
    description: "Create a graph node (task, epic, decision, risk, …) — provenance tagged.",
    usage: "/add <type> --title \"…\" [flags]   ·   mcp-graph add <type> ...",
    slashAliases: ["add"],
    shellAliases: ["add"],
    category: "lifecycle",
    emitSkill: true,
    examples: [
      "mcp-graph add task --title \"fix auth bug\" --priority 2",
      "mcp-graph add epic --title \"Q4 onboarding\" --xpSize XL",
      "mcp-graph add risk --title \"vendor outage\" --tags infra,blocker",
    ],
    handler: async (ctx) => {
      const { runAdd } = await import("./add.js");
      return runAdd(ctx);
    },
  });

  registerCommand({
    id: "harness",
    name: "harness",
    description:
      "Browser harness: list/start/stop/call/cdp/add helpers via the parent's CDP module.",
    usage:
      "/harness <list|start|stop|call|cdp|add|sessions> [args]   ·   mcp-graph harness …",
    slashAliases: ["harness"],
    shellAliases: ["harness"],
    category: "browser",
    emitSkill: true,
    examples: [
      "/harness list",
      "/harness start --cdp ws://127.0.0.1:9222/devtools/browser/<id>",
      "mcp-graph harness call screenshot --sid <id> --args '{\"selector\":\"body\"}'",
      "mcp-graph harness sessions --json",
    ],
    handler: async (ctx) => {
      const { runHarness } = await import("./harness.js");
      return runHarness(ctx);
    },
  });

  registerCommand({
    id: "ui",
    name: "ui",
    description:
      "Launch the dashboard (Express :3000). Wraps the parent's serve command.",
    usage: "/ui [--port N]   ·   mcp-graph ui",
    slashAliases: ["ui", "dashboard"],
    shellAliases: ["ui", "dashboard"],
    category: "ops",
    emitSkill: true,
    examples: ["/ui", "mcp-graph ui --port 3377", "mcp-graph ui --json"],
    handler: async (ctx) => {
      const { runUi } = await import("./ui.js");
      return runUi(ctx);
    },
  });

  registerCommand({
    id: "list",
    name: "list",
    description: "List nodes (default: actionable tasks). Filters by status/type/search.",
    usage: "/list [--status …] [--type …] [--search …] [--all]   ·   mcp-graph list",
    slashAliases: ["list", "ls"],
    shellAliases: ["list", "ls"],
    category: "lifecycle",
    emitSkill: true,
    examples: [
      "/list",
      "mcp-graph list --status in_progress",
      "mcp-graph list --search auth",
      "mcp-graph list --type epic --limit 50",
    ],
    handler: async (ctx) => {
      const { runList } = await import("./list.js");
      return runList(ctx);
    },
  });

  registerCommand({
    id: "start",
    name: "start",
    description: "Begin a task: status → in_progress, render TDD checklist + AC.",
    usage: "/start <id>   ·   mcp-graph start <id>",
    slashAliases: ["start"],
    shellAliases: ["start"],
    category: "lifecycle",
    emitSkill: true,
    examples: ["/start node_799f48ee8dfb", "mcp-graph start node_799f48ee8dfb --json"],
    handler: async (ctx) => {
      const { runStart } = await import("./start.js");
      return runStart(ctx);
    },
  });

  registerCommand({
    id: "finish",
    name: "finish",
    description: "Complete the in-progress task: status → done, suggest next.",
    usage: "/finish [<id>]   ·   mcp-graph finish [<id>]",
    slashAliases: ["finish", "done"],
    shellAliases: ["finish", "done"],
    category: "lifecycle",
    emitSkill: true,
    examples: ["/finish", "mcp-graph finish node_799f48ee8dfb"],
    handler: async (ctx) => {
      const { runFinish } = await import("./finish.js");
      return runFinish(ctx);
    },
  });

  registerCommand({
    id: "next",
    name: "next",
    description: "Show the next unblocked task (animated card).",
    usage: "/next [--id]   ·   mcp-graph next",
    slashAliases: ["next", "n"],
    shellAliases: ["next"],
    category: "lifecycle",
    emitSkill: true,
    examples: ["/next", "mcp-graph next --json", "mcp-graph next --id"],
    handler: async (ctx) => {
      const { runNext } = await import("./next.js");
      return runNext(ctx);
    },
  });

  registerCommand({
    id: "status",
    name: "status",
    description:
      "1-screen project health: tasks, sprint progress, harness, bridge auth.",
    usage: "/status [--oneline]   ·   mcp-graph status",
    slashAliases: ["status"],
    shellAliases: ["status"],
    category: "ops",
    emitSkill: true,
    handler: async (ctx) => {
      const { runStatus } = await import("./status.js");
      return runStatus(ctx);
    },
  });

  registerCommand({
    id: "set-phase",
    name: "set-phase",
    description:
      "Override lifecycle phase + strict/advisory enforcement modes (replaces deprecated set_phase MCP tool).",
    usage:
      "/set-phase <PHASE> [--mode strict|advisory] [--code-intel strict|advisory|off] [--prerequisites strict|advisory|off] [--force] [--json]",
    slashAliases: ["set-phase"],
    shellAliases: ["set-phase"],
    category: "lifecycle",
    emitSkill: true,
    examples: [
      "mcp-graph set-phase IMPLEMENT --mode strict",
      "mcp-graph set-phase auto",
      "mcp-graph set-phase PLAN --code-intel advisory --prerequisites advisory",
    ],
    handler: async (ctx) => {
      const { runSetPhase } = await import("./set-phase.js");
      return runSetPhase(ctx);
    },
  });
}
