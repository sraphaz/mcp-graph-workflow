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

interface ListNode {
  readonly id: string;
  readonly type: string;
  readonly title?: string;
  readonly name?: string;
  readonly description?: string;
  readonly status?: string;
  readonly priority?: number;
  readonly xpSize?: string;
  readonly blocked?: boolean;
  readonly tags?: readonly string[];
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): {
      toGraphDocument(): { nodes: ReadonlyArray<ListNode> };
      close(): void;
    };
  };
}

const DEFAULT_LIMIT = 30;
const KNOWN_STATUSES = [
  "backlog",
  "ready",
  "in_progress",
  "review",
  "done",
  "blocked",
  "cancelled",
] as const;
const KNOWN_TYPES = [
  "task",
  "subtask",
  "epic",
  "decision",
  "risk",
  "milestone",
  "ac",
] as const;

export async function runList(
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

  const storeMod = (await parent.loadStore()) as StoreModule;
  const store = storeMod.SqliteStore.open(process.cwd());
  let nodes: ReadonlyArray<ListNode>;
  try {
    nodes = store.toGraphDocument().nodes;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 1,
      text: `${msg}\n  → run \`mg init\` to bootstrap a project here.`,
    };
  } finally {
    try {
      store.close();
    } catch {
      // ignore
    }
  }

  const filtered = applyFilters(nodes, ctx.flags);
  const limit = parseLimit(ctx.flags) ?? DEFAULT_LIMIT;
  const visible = filtered.slice(0, limit);

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        total: filtered.length,
        showing: visible.length,
        nodes: visible.map((n) => ({
          id: n.id,
          type: n.type,
          status: n.status,
          title: n.title ?? n.name,
          priority: n.priority,
          xpSize: n.xpSize,
          blocked: n.blocked,
        })),
      },
    };
  }

  const element = (
    <ListCard nodes={visible} total={filtered.length} flags={ctx.flags} />
  );
  return { exitCode: 0, element };
}

function applyFilters(
  nodes: ReadonlyArray<ListNode>,
  flags: Record<string, string | boolean>,
): ListNode[] {
  const status = typeof flags.status === "string" ? flags.status : null;
  const type = typeof flags.type === "string" ? flags.type : null;
  const search = typeof flags.search === "string" ? flags.search.toLowerCase() : null;
  const showAll = Boolean(flags.all);
  const blockedOnly = Boolean(flags.blocked);

  return nodes
    .filter((n) => {
      if (status && n.status !== status) return false;
      if (type && n.type !== type) return false;
      if (blockedOnly && !n.blocked) return false;
      if (!showAll && !status && !type && !search && !blockedOnly) {
        // default: hide done + cancelled to make the list actionable
        if (n.status === "done" || n.status === "cancelled") return false;
      }
      if (search) {
        const haystack =
          `${n.id} ${n.title ?? n.name ?? ""} ${n.description ?? ""} ${(n.tags ?? []).join(" ")}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const sa = statusRank(a.status);
      const sb = statusRank(b.status);
      if (sa !== sb) return sa - sb;
      const pa = a.priority ?? 99;
      const pb = b.priority ?? 99;
      if (pa !== pb) return pa - pb;
      return a.id.localeCompare(b.id);
    });
}

function statusRank(status: string | undefined): number {
  switch (status) {
    case "in_progress":
      return 0;
    case "review":
      return 1;
    case "ready":
      return 2;
    case "backlog":
      return 3;
    case "blocked":
      return 4;
    case "done":
      return 5;
    case "cancelled":
      return 6;
    default:
      return 7;
  }
}

function parseLimit(flags: Record<string, string | boolean>): number | null {
  const raw = flags.limit;
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

interface ListCardProps {
  readonly nodes: ReadonlyArray<ListNode>;
  readonly total: number;
  readonly flags: Record<string, string | boolean>;
}

function ListCard({ nodes, total, flags }: ListCardProps): JSX.Element {
  if (nodes.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="yellow">{t("list.empty")}</Text>
        <Text dimColor>{filterHint(flags)}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text color="cyan" bold>
          {t("list.header", { shown: nodes.length, total })}
        </Text>
        {filterDescription(flags) && (
          <Text dimColor>{`  ·  ${filterDescription(flags)}`}</Text>
        )}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {nodes.map((n) => (
          <ListRow key={n.id} node={n} />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {t("list.startHint")}
          <Text color="green">mg start &lt;id&gt;</Text>
          <Text dimColor>{t("list.filterLabel")}</Text>
          <Text color="green">--status</Text>
          <Text dimColor>{` / `}</Text>
          <Text color="green">--type</Text>
          <Text dimColor>{` / `}</Text>
          <Text color="green">--search</Text>
        </Text>
      </Box>
      {total > nodes.length && (
        <Box>
          <Text dimColor>{t("list.moreHint", { n: total - nodes.length, total })}</Text>
        </Box>
      )}
    </Box>
  );
}

function ListRow({ node }: { readonly node: ListNode }): JSX.Element {
  const statusColor = statusToColor(node.status);
  const statusLabel = (node.status ?? "?").padEnd(11);
  const typeLabel = node.type.padEnd(8);
  const priorityLabel =
    node.priority !== undefined ? `P${node.priority}` : "  ";

  return (
    <Box>
      <Text color={statusColor}>{`  ${statusLabel}`}</Text>
      <Text dimColor>{`${typeLabel} `}</Text>
      <Text dimColor>{`${priorityLabel.padEnd(3)}`}</Text>
      <Text>{`${node.id.slice(0, 18).padEnd(18)} `}</Text>
      <Text>{truncate(node.title ?? node.name ?? t("common.untitled"), 60)}</Text>
      {node.blocked && <Text color="red">{` ⛔`}</Text>}
    </Box>
  );
}

function statusToColor(status: string | undefined): string {
  switch (status) {
    case "in_progress":
      return "yellow";
    case "review":
      return "cyan";
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

function filterDescription(flags: Record<string, string | boolean>): string {
  const parts: string[] = [];
  if (typeof flags.status === "string") parts.push(`status=${flags.status}`);
  if (typeof flags.type === "string") parts.push(`type=${flags.type}`);
  if (typeof flags.search === "string") parts.push(`search="${flags.search}"`);
  if (flags.blocked) parts.push("blocked");
  if (flags.all) parts.push("all (incl. done)");
  return parts.join("  ·  ");
}

function filterHint(flags: Record<string, string | boolean>): string {
  if (typeof flags.status === "string" && !KNOWN_STATUSES.includes(flags.status as never)) {
    return `unknown status — try one of: ${KNOWN_STATUSES.join(", ")}`;
  }
  if (typeof flags.type === "string" && !KNOWN_TYPES.includes(flags.type as never)) {
    return `unknown type — try one of: ${KNOWN_TYPES.join(", ")}`;
  }
  return "try `mg list --all` to include done/cancelled, or change --status / --type.";
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}
