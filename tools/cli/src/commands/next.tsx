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
  readonly name?: string;
  readonly description?: string;
  readonly priority?: number;
  readonly xpSize?: string;
  readonly estimateMinutes?: number;
  readonly status?: string;
  readonly acceptanceCriteria?: ReadonlyArray<{ id?: string; text: string; testable?: boolean }>;
  readonly tags?: readonly string[];
}

interface NextResult {
  readonly node: MinimalNode;
  readonly reason: string;
  readonly warning?: string;
}

interface PlannerModule {
  findNextTask(
    doc: unknown,
    options?: { lockedTaskIds?: Set<string> },
  ): NextResult | null;
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): {
      toGraphDocument(): unknown;
      close(): void;
    };
  };
}

export async function runNext(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
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
  let result: NextResult | null;
  try {
    let doc: unknown;
    try {
      doc = store.toGraphDocument();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        exitCode: 1,
        text: `${msg}\n  → run \`mcp-graph init\` to bootstrap a project here.`,
      };
    }
    result = plannerMod.findNextTask(doc);
  } finally {
    try {
      store.close();
    } catch {
      // ignore
    }
  }

  if (!result) {
    return { exitCode: 0, text: t("next.empty") };
  }

  const titleOf = (n: MinimalNode): string =>
    n.title ?? n.name ?? "(untitled)";

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        id: result.node.id,
        title: titleOf(result.node),
        type: result.node.type,
        priority: result.node.priority,
        xpSize: result.node.xpSize,
        reason: result.reason,
        warning: result.warning,
      },
    };
  }

  if (ctx.flags.id) {
    return { exitCode: 0, text: result.node.id };
  }

  return {
    exitCode: 0,
    element: <NextCard result={result} />,
  };
}

interface NextCardProps {
  readonly result: NextResult;
}

function NextCard({ result }: NextCardProps): JSX.Element {
  const { node, reason, warning } = result;
  const acs = (node.acceptanceCriteria ?? []).slice(0, 5);

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
      <Box>
        <Text color="cyan" bold>
          {t("next.title")}
        </Text>
        <Text dimColor>{`  ${node.id}`}</Text>
      </Box>
      <Box marginTop={1}>
        <Text bold>{node.title ?? node.name ?? t("common.untitled")}</Text>
      </Box>
      {node.description && (
        <Box marginTop={1}>
          <Text>{truncate(node.description, 220)}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {`type: ${node.type}`}
          {node.priority !== undefined ? `  ·  priority: ${node.priority}` : ""}
          {node.xpSize ? `  ·  size: ${node.xpSize}` : ""}
          {node.estimateMinutes !== undefined
            ? `  ·  est: ${node.estimateMinutes}m`
            : ""}
        </Text>
      </Box>
      {acs.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{t("next.acHeader")}</Text>
          {acs.map((ac, i) => (
            <Text key={ac.id ?? i}>
              <Text color="green">  ☐ </Text>
              <Text>{ac.text}</Text>
            </Text>
          ))}
          {(node.acceptanceCriteria?.length ?? 0) > acs.length && (
            <Text dimColor>{t("next.acMore", { n: (node.acceptanceCriteria?.length ?? 0) - acs.length })}</Text>
          )}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor italic>
          {reason}
        </Text>
      </Box>
      {warning && (
        <Box marginTop={1}>
          <Text color="yellow">{`⚠ ${warning}`}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          {t("next.startHint")}
          <Text color="green">{`mcp-graph start ${node.id}`}</Text>
          <Text dimColor>{t("next.seeAll")}</Text>
          <Text color="green">mcp-graph list</Text>
        </Text>
      </Box>
    </Box>
  );
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
