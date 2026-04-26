/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import { t } from "../i18n/index.js";
import {
  type ConfigSyncResult,
  checkConfigs,
  syncConfigs,
} from "../core/init/sync-configs.js";
import type { ScaffoldChange } from "../core/init/scaffold.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `mcp-graph config <action>` — manage IDE/agent configs.
 *
 *   mcp-graph config sync   — emit/refresh .mcp.json, .vscode/mcp.json (if VS Code),
 *                      .cursor/mcp.json (if Cursor), .claude/settings.local.json
 *   mcp-graph config check  — dry-run; report drift without writing
 */

export async function runConfig(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const action = ctx.args[0] ?? "sync";

  switch (action) {
    case "sync":
      return doSync(ctx);
    case "check":
      return doCheck(ctx);
    default:
      return {
        exitCode: 2,
        text: [
          `unknown config action: ${action}`,
          "",
          "  mcp-graph config sync    — emit/refresh all IDE/agent configs",
          "  mcp-graph config check   — report drift without writing",
        ].join("\n"),
      };
  }
}

function doSync(ctx: CommandHandlerArgs): CommandHandlerResult {
  const result = syncConfigs(process.cwd(), { force: Boolean(ctx.flags.force) });

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        cwd: result.cwd,
        ides: result.ides,
        changes: result.changes,
      },
    };
  }

  return {
    exitCode: 0,
    element: <SyncCard result={result} />,
  };
}

function doCheck(ctx: CommandHandlerArgs): CommandHandlerResult {
  const result = checkConfigs(process.cwd());

  if (ctx.flags.json) {
    return {
      exitCode: result.inSync ? 0 : 1,
      json: {
        inSync: result.inSync,
        drift: result.drift,
      },
    };
  }

  return {
    exitCode: result.inSync ? 0 : 1,
    element: <CheckCard inSync={result.inSync} drift={result.drift} />,
  };
}

function SyncCard({ result }: { readonly result: ConfigSyncResult }): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="green" bold>
        {t("config.synced", { ides: result.ides.join(", ") || "no IDE detected" })}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {result.changes.map((c) => (
          <ChangeRow key={c.path} change={c} />
        ))}
      </Box>
    </Box>
  );
}

function CheckCard({
  inSync,
  drift,
}: {
  readonly inSync: boolean;
  readonly drift: ReadonlyArray<ScaffoldChange>;
}): JSX.Element {
  if (inSync) {
    return (
      <Box paddingX={1}>
        <Text color="green">{t("config.inSync")}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="yellow" bold>
        {t("config.drift", { n: drift.length })}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {drift.map((c) => (
          <ChangeRow key={c.path} change={c} />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{t("config.applyHint")}</Text>
      </Box>
    </Box>
  );
}

function ChangeRow({ change }: { readonly change: ScaffoldChange }): JSX.Element {
  return (
    <Text>
      <Text color={colorFor(change.action)}>{labelFor(change.action)}</Text>
      <Text>{` ${change.path}`}</Text>
    </Text>
  );
}

function colorFor(action: ScaffoldChange["action"]): string {
  switch (action) {
    case "created":
      return "green";
    case "patched":
      return "yellow";
    case "skipped-existing":
    case "skipped-noop":
      return "gray";
  }
}

function labelFor(action: ScaffoldChange["action"]): string {
  switch (action) {
    case "created":
      return "+ created     ";
    case "patched":
      return "~ patched     ";
    case "skipped-existing":
      return "· kept (yours)";
    case "skipped-noop":
      return "· in-sync     ";
  }
}
