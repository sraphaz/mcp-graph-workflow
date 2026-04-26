/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import {
  type HookProfile,
  installHooks,
  listInstalledHooks,
  uninstallHooks,
} from "../core/hooks/install.js";
import { summarizeHookActivity } from "../core/log/structured-logger.js";
import { t } from "../i18n/index.js";
import type { ScaffoldChange } from "../core/init/scaffold.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

// Sprint 7.5 #7.5.10 — map a Claude Code hook event name (used by the
// installer / `__mg__` tag) to the dispatcher action name written into
// hooks.jsonl by hook-dispatch.ts. The two namespaces don't overlap by
// accident: Claude Code uses PascalCase event names ("SessionStart"),
// while `mcp-graph hook <name>` uses kebab-case ("session-start"). This map is
// the single source of truth used by both the installer's PROFILES and
// the activity rendering in `mcp-graph hooks status`.
const HOOK_EVENT_TO_ACTION: Record<string, string> = {
  SessionStart: "session-start",
  Stop: "session-stop",
  PostToolUse: "post-edit",
  PreToolUse: "pre-tool-use",
  UserPromptSubmit: "pre-prompt",
};

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  if (ms < 0) return "in the future";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/**
 * `mcp-graph hooks <action>` — install / uninstall / status for Claude Code hooks.
 *
 *   mcp-graph hooks install [--profile minimal|balanced|aggressive]
 *   mcp-graph hooks uninstall
 *   mcp-graph hooks status
 */

export async function runHooks(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const action = ctx.args[0] ?? "status";

  switch (action) {
    case "install":
      return doInstall(ctx);
    case "uninstall":
      return doUninstall(ctx);
    case "status":
    case "list":
      return doStatus(ctx);
    default:
      return {
        exitCode: 2,
        text: [
          `unknown hooks action: ${action}`,
          "",
          "  mcp-graph hooks install [--profile minimal|balanced|aggressive]",
          "  mcp-graph hooks uninstall",
          "  mcp-graph hooks status",
        ].join("\n"),
      };
  }
}

function doInstall(ctx: CommandHandlerArgs): CommandHandlerResult {
  const profile = parseProfile(ctx.flags.profile);
  const change = installHooks(process.cwd(), { profile });

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: { profile, change },
    };
  }

  return {
    exitCode: 0,
    element: <InstallCard profile={profile} change={change} />,
  };
}

function doUninstall(ctx: CommandHandlerArgs): CommandHandlerResult {
  const change = uninstallHooks(process.cwd());

  if (ctx.flags.json) {
    return { exitCode: 0, json: { change } };
  }

  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column" paddingX={1}>
        <Text color="green">{t("hooks.uninstalled")}</Text>
        <Box marginTop={1}>
          <Text dimColor>{`  ${change.action}  ${change.path}`}</Text>
        </Box>
      </Box>
    ),
  };
}

function doStatus(ctx: CommandHandlerArgs): CommandHandlerResult {
  const installed = listInstalledHooks(process.cwd());
  // Sprint 7.5 #7.5.10 — pull last-fire / last-error per hook action
  // from hooks.jsonl. Indexed by action name (e.g. "session-start"),
  // resolved per-hook via HOOK_EVENT_TO_ACTION below.
  const activity = summarizeHookActivity();

  if (ctx.flags.json) {
    const enriched = installed.map((h) => {
      const a = HOOK_EVENT_TO_ACTION[h.event] ?? h.event.toLowerCase();
      const stats = activity[a];
      return {
        ...h,
        action: a,
        lastFire: stats?.lastFire,
        lastError: stats?.lastError,
        fireCount: stats?.fireCount ?? 0,
        errorCount: stats?.errorCount ?? 0,
      };
    });
    return { exitCode: 0, json: { installed: enriched } };
  }

  if (installed.length === 0) {
    return {
      exitCode: 0,
      element: (
        <Box paddingX={1}>
          <Text dimColor>{t("hooks.empty")}</Text>
        </Box>
      ),
    };
  }

  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>{`mcp-graph hooks  (${installed.length})`}</Text>
        <Box flexDirection="column" marginTop={1}>
          {installed.map((h, i) => {
            const action = HOOK_EVENT_TO_ACTION[h.event] ?? h.event.toLowerCase();
            const stats = activity[action];
            const fireText = stats?.lastFire ? relativeTime(stats.lastFire) : "never";
            const errText =
              stats?.lastError != null
                ? `last err ${relativeTime(stats.lastError)} (${stats.errorCount}/${stats.fireCount})`
                : null;
            return (
              <Box key={i} flexDirection="column">
                <Box>
                  <Text color="cyan">{`  ${h.event.padEnd(18)}`}</Text>
                  <Text dimColor>{`  ${(h.matcher ?? "*").padEnd(28)}`}</Text>
                  <Text>{h.command}</Text>
                </Box>
                <Box>
                  <Text dimColor>{`    fired ${fireText}`}</Text>
                  {errText && <Text color="red">{` · ${errText}`}</Text>}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    ),
  };
}

function parseProfile(value: string | boolean | undefined): HookProfile {
  if (value === "minimal" || value === "balanced" || value === "aggressive") {
    return value;
  }
  return "balanced";
}

function InstallCard({
  profile,
  change,
}: {
  readonly profile: HookProfile;
  readonly change: ScaffoldChange;
}): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="green" bold>
        {t("hooks.installed", { profile })}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{`  ${change.action}  ${change.path}`}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Text>
          <Text dimColor>{"workflow self-drives now: harness scan on edit, status banner on session start, snapshot on stop. "}</Text>
        </Text>
        <Text>
          <Text dimColor>{"override anytime with "}</Text>
          <Text color="green">mcp-graph hooks uninstall</Text>
          <Text dimColor>{" or env "}</Text>
          <Text color="green">MCP_GRAPH_HOOKS_OFF=1</Text>
        </Text>
      </Box>
    </Box>
  );
}
