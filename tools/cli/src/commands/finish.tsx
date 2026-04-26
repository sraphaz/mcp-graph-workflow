/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import { t } from "../i18n/index.js";
import {
  ParentNotInstalledError,
  getParentRuntime,
} from "../core/parent-bridge.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

interface MinimalNode {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly status?: string;
  readonly priority?: number;
}

interface NextResult {
  readonly node: MinimalNode;
  readonly reason: string;
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): {
      getNodeById(id: string): MinimalNode | null;
      updateNodeStatus(id: string, status: string): MinimalNode | null;
      getAllNodes(): MinimalNode[];
      toGraphDocument(): unknown;
      close(): void;
    };
  };
}

interface PlannerModule {
  findNextTask(doc: unknown): NextResult | null;
}

export async function runFinish(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  // ID is optional: if omitted, finish the (single) in_progress task. If
  // multiple are in progress, require an explicit id.
  let id = ctx.args[0];

  let parent;
  try {
    parent = await getParentRuntime();
  } catch (err) {
    if (err instanceof ParentNotInstalledError) {
      return { exitCode: 127, text: err.hint };
    }
    throw err;
  }

  const [storeMod, plannerMod] = (await Promise.all([
    parent.loadStore(),
    parent.loadPlanner(),
  ])) as [StoreModule, PlannerModule];

  const store = storeMod.SqliteStore.open(process.cwd());
  let finished: MinimalNode | null = null;
  let nextSuggestion: NextResult | null = null;
  try {
    if (!id) {
      const inProgress = store
        .getAllNodes()
        .filter((n) => n.status === "in_progress");
      if (inProgress.length === 0) {
        return {
          exitCode: 1,
          text: "no in_progress task found. Pass an id: `mcp-graph finish <node_xxx>`.",
        };
      }
      if (inProgress.length > 1) {
        return {
          exitCode: 2,
          text: [
            `${inProgress.length} tasks are in progress — pass an explicit id:`,
            ...inProgress.map((n) => `  mcp-graph finish ${n.id}   # ${n.title ?? ""}`),
          ].join("\n"),
        };
      }
      id = inProgress[0].id;
    }

    const original = store.getNodeById(id);
    if (!original) {
      return { exitCode: 1, text: `node not found: ${id}` };
    }
    if (original.status === "done") {
      return {
        exitCode: 0,
        text: `${id} is already done.`,
      };
    }
    if (original.status !== "in_progress") {
      return {
        exitCode: 1,
        text: `cannot finish a node with status=${original.status}. Run \`mcp-graph start ${id}\` first.`,
      };
    }

    finished = store.updateNodeStatus(id, "done");
    if (!finished) {
      return { exitCode: 1, text: `failed to update node: ${id}` };
    }

    try {
      const doc = store.toGraphDocument();
      nextSuggestion = plannerMod.findNextTask(doc);
    } catch {
      // suggestion is best-effort
    }
  } finally {
    try {
      store.close();
    } catch {
      // ignore
    }
  }

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        id: finished.id,
        title: finished.title,
        status: "done",
        next: nextSuggestion
          ? { id: nextSuggestion.node.id, title: nextSuggestion.node.title, reason: nextSuggestion.reason }
          : null,
      },
    };
  }

  return {
    exitCode: 0,
    element: <FinishCard finished={finished} next={nextSuggestion} />,
  };
}

interface FinishCardProps {
  readonly finished: MinimalNode;
  readonly next: NextResult | null;
}

function FinishCard({ finished, next }: FinishCardProps): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="green">
      <Box>
        <Text color="green" bold>
          {t("finish.success")}
        </Text>
        <Text dimColor>{`  ${finished.id}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text bold>{finished.title ?? t("common.untitled")}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {`type: ${finished.type}`}
          {finished.priority !== undefined ? `  ·  priority: ${finished.priority}` : ""}
        </Text>
      </Box>
      {next ? (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">{t("finish.nextHeader")}</Text>
          <Box>
            <Text>{`  ${next.node.id}  `}</Text>
            <Text>{next.node.title ?? t("common.untitled")}</Text>
          </Box>
          <Text dimColor>{`  ${next.reason}`}</Text>
          <Box marginTop={1}>
            <Text dimColor>{t("next.startHint")}</Text>
            <Text color="green">{`mcp-graph start ${next.node.id}`}</Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>{t("finish.noMore")}</Text>
        </Box>
      )}
    </Box>
  );
}
