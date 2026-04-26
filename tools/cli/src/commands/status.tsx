/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import { runBridge } from "../core/bridge/spawn.js";
import { t } from "../i18n/index.js";
import {
  ParentNotInstalledError,
  getParentRuntime,
} from "../core/parent-bridge.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

interface StatusNode {
  readonly id: string;
  readonly type: string;
  readonly status?: string;
  readonly title?: string;
  readonly blocked?: boolean;
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): {
      getAllNodes(): StatusNode[];
      close(): void;
    };
  };
}

interface StatusSummary {
  readonly project: string;
  readonly counts: Record<string, number>;
  readonly inProgress: ReadonlyArray<{ id: string; title?: string }>;
  readonly blockers: ReadonlyArray<{ id: string; title?: string }>;
  readonly bridge: "ok" | "missing" | "unreachable";
  readonly graphAvailable: boolean;
}

export async function runStatus(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const oneline = Boolean(ctx.flags.oneline);
  const summary = await collectStatus();

  if (ctx.flags.json) {
    return { exitCode: 0, json: summary };
  }

  if (oneline) {
    return { exitCode: 0, text: oneLine(summary) };
  }

  return {
    exitCode: 0,
    element: <StatusCard summary={summary} />,
  };
}

async function collectStatus(): Promise<StatusSummary> {
  const project =
    process.cwd().split("/").pop() ?? "(unknown)";

  let nodes: StatusNode[] = [];
  let graphAvailable = false;
  try {
    const parent = await getParentRuntime();
    const mod = (await parent.loadStore()) as StoreModule;
    const store = mod.SqliteStore.open(process.cwd());
    try {
      nodes = store.getAllNodes();
      graphAvailable = true;
    } finally {
      try {
        store.close();
      } catch {
        // ignore
      }
    }
  } catch (err) {
    if (!(err instanceof ParentNotInstalledError)) {
      // graph readable but errored — surface as graph-unavailable
    }
  }

  const counts: Record<string, number> = {};
  const inProgress: Array<{ id: string; title?: string }> = [];
  const blockers: Array<{ id: string; title?: string }> = [];
  for (const n of nodes) {
    const status = n.status ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    if (status === "in_progress") {
      inProgress.push({ id: n.id, title: n.title });
    }
    if (n.blocked) {
      blockers.push({ id: n.id, title: n.title });
    }
  }

  const bridge = await checkBridge();

  return { project, counts, inProgress, blockers, bridge, graphAvailable };
}

async function checkBridge(): Promise<"ok" | "missing" | "unreachable"> {
  // Lightweight: ask bridge-cli for `status`. inheritStdio=false so we
  // capture and don't pollute the user's screen.
  const result = await runBridge({
    subcommand: "status",
    inheritStdio: false,
  });
  if (result.locator === null || result.exitCode === 127) return "missing";
  if (result.exitCode !== 0) return "unreachable";
  return "ok";
}

function oneLine(s: StatusSummary): string {
  const total = Object.values(s.counts).reduce((a, b) => a + b, 0);
  const done = s.counts.done ?? 0;
  return `${s.project}: ${done}/${total} done · ${s.inProgress.length} in progress · ${s.blockers.length} blocked · bridge: ${s.bridge}`;
}

function StatusCard({
  summary,
}: {
  readonly summary: StatusSummary;
}): JSX.Element {
  const total = Object.values(summary.counts).reduce((a, b) => a + b, 0);
  const done = summary.counts.done ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color="cyan" bold>
          {`◇ ${summary.project}`}
        </Text>
      </Box>
      {!summary.graphAvailable && (
        <Box marginTop={1}>
          <Text color="yellow">
            {t("status.graphUnavailable")}
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{t("status.progressLabel")}</Text>
        <Text bold>{`${done}/${total}`}</Text>
        <Text dimColor>{`  (${pct}%)`}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {Object.entries(summary.counts).map(([status, n]) => (
          <Text key={status}>
            <Text color={statusColor(status)}>{`  ${status.padEnd(13)}`}</Text>
            <Text>{`${String(n).padStart(4)}`}</Text>
          </Text>
        ))}
      </Box>
      {summary.inProgress.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="yellow">{t("status.inProgressHeader", { n: summary.inProgress.length })}</Text>
          {summary.inProgress.slice(0, 3).map((n) => (
            <Box key={n.id}>
              <Text dimColor>{`  `}</Text>
              <Text>{`${n.id}  `}</Text>
              <Text>{n.title ?? t("common.untitled")}</Text>
            </Box>
          ))}
        </Box>
      )}
      {summary.blockers.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="red">{t("status.blockedHeader", { n: summary.blockers.length })}</Text>
          {summary.blockers.slice(0, 3).map((n) => (
            <Box key={n.id}>
              <Text dimColor>{`  `}</Text>
              <Text>{`${n.id}  `}</Text>
              <Text>{n.title ?? t("common.untitled")}</Text>
            </Box>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{t("status.bridgeLabel")}</Text>
        <Text color={bridgeColor(summary.bridge)}>{summary.bridge}</Text>
        {summary.bridge !== "ok" && (
          <Text dimColor>{t("status.bridgeHint")}</Text>
        )}
        {summary.bridge !== "ok" && <Text color="green">mcp-graph login</Text>}
        {summary.bridge !== "ok" && <Text dimColor>{`)`}</Text>}
      </Box>
    </Box>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "in_progress":
      return "yellow";
    case "ready":
      return "green";
    case "backlog":
      return "blue";
    case "done":
      return "gray";
    case "blocked":
      return "red";
    default:
      return "white";
  }
}

function bridgeColor(state: "ok" | "missing" | "unreachable"): string {
  switch (state) {
    case "ok":
      return "green";
    case "unreachable":
      return "yellow";
    case "missing":
      return "red";
  }
}
