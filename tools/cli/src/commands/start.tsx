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
  readonly description?: string;
  readonly status?: string;
  readonly priority?: number;
  readonly xpSize?: string;
  readonly acceptanceCriteria?: ReadonlyArray<string | { id?: string; text: string }>;
  readonly testFiles?: readonly string[];
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): {
      getNodeById(id: string): MinimalNode | null;
      updateNodeStatus(id: string, status: string): MinimalNode | null;
      close(): void;
    };
  };
}

const STARTABLE_FROM = ["backlog", "ready", "blocked"] as const;

export async function runStart(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const id = ctx.args[0];
  if (!id) {
    return {
      exitCode: 2,
      text: "usage: mg start <node-id>\n  hint: `mg next` to see the suggested next task.",
    };
  }

  let parent;
  try {
    parent = await getParentRuntime();
  } catch (err) {
    if (err instanceof ParentNotInstalledError) {
      return { exitCode: 127, text: err.hint };
    }
    throw err;
  }

  const storeMod = (await parent.loadStore()) as StoreModule;
  const store = storeMod.SqliteStore.open(process.cwd());
  let updated: MinimalNode | null;
  let original: MinimalNode | null;
  try {
    original = store.getNodeById(id);
    if (!original) {
      return { exitCode: 1, text: `node not found: ${id}` };
    }
    if (original.status === "in_progress") {
      // Already started — render the same card so the user gets the context.
      updated = original;
    } else if (original.status === "done") {
      return {
        exitCode: 1,
        text: `node ${id} is already done. Use \`mg next\` for the next task.`,
      };
    } else if (!STARTABLE_FROM.includes(original.status as never)) {
      return {
        exitCode: 1,
        text: `cannot start a node with status=${original.status}.\n  expected one of: ${STARTABLE_FROM.join(", ")}`,
      };
    } else {
      updated = store.updateNodeStatus(id, "in_progress");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, text: `failed to start node: ${msg}` };
  } finally {
    try {
      store.close();
    } catch {
      // ignore
    }
  }

  if (!updated) {
    return { exitCode: 1, text: `node not found after update: ${id}` };
  }

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        id: updated.id,
        title: updated.title,
        previousStatus: original.status,
        status: updated.status ?? "in_progress",
      },
    };
  }

  return {
    exitCode: 0,
    element: <StartCard node={updated} previousStatus={original.status} />,
  };
}

interface StartCardProps {
  readonly node: MinimalNode;
  readonly previousStatus?: string;
}

function StartCard({ node, previousStatus }: StartCardProps): JSX.Element {
  const acs = (node.acceptanceCriteria ?? []).map((ac) =>
    typeof ac === "string" ? ac : ac.text,
  );
  const startedNow = previousStatus !== "in_progress";

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="yellow">
      <Box>
        <Text color="yellow" bold>
          {startedNow ? t("start.started") : t("start.inProgress")}
        </Text>
        <Text dimColor>{`  ${node.id}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text bold>{node.title ?? t("common.untitled")}</Text>
      </Box>
      {node.description && (
        <Box marginTop={1}>
          <Text>{truncate(node.description, 280)}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {`type: ${node.type}`}
          {node.priority !== undefined ? `  ·  priority: ${node.priority}` : ""}
          {node.xpSize ? `  ·  size: ${node.xpSize}` : ""}
        </Text>
      </Box>
      {acs.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{t("next.acHeader")}</Text>
          {acs.map((text, i) => (
            <Text key={i}>
              <Text color="green">  ☐ </Text>
              <Text>{text}</Text>
            </Text>
          ))}
        </Box>
      )}
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">{t("start.tddHeader")}</Text>
        <Text>
          <Text color="green">  ☐ </Text>
          <Text>{t("start.tdd1")}</Text>
        </Text>
        <Text>
          <Text color="green">  ☐ </Text>
          <Text>{t("start.tdd2")}</Text>
        </Text>
        <Text>
          <Text color="green">  ☐ </Text>
          <Text>{t("start.tdd3")}</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {t("start.whenDone")}
          <Text color="green">{`mg finish`}</Text>
        </Text>
      </Box>
    </Box>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
