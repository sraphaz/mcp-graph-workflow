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

/**
 * `mcp-graph add <type>` — create a graph node.
 *
 * Two modes:
 *   - **scripted** (default if --title provided or --json):
 *       mcp-graph add task --title "fix bug" --priority 2 --xpSize S --description "..."
 *   - **interactive** (Clack prompts; only when stdin TTY available and no --title):
 *       mcp-graph add task   → prompts walk through fields
 *
 * Sprint 7.6 provenance: every created node carries
 *   metadata.provenance = { source: "cli", actor, cmd, trace_id, ts }
 */

const NODE_TYPES = [
  "task", "epic", "subtask", "requirement", "constraint",
  "milestone", "acceptance_criteria", "risk", "decision",
] as const;

const PRIORITIES = [1, 2, 3, 4, 5] as const;
const XP_SIZES = ["XS", "S", "M", "L", "XL"] as const;
const STATUSES = ["backlog", "ready", "in_progress", "blocked", "done"] as const;

interface NewNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  xpSize?: string;
  estimateMinutes?: number;
  tags?: string[];
  parentId?: string;
  acceptanceCriteria?: string[];
  blocked: boolean;
  metadata: { provenance: ProvenanceMeta; [k: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

interface ProvenanceMeta {
  source: "cli";
  actor: string;
  cmd: string;
  trace_id?: string;
  ts: string;
}

interface StoreModule {
  SqliteStore: {
    open(basePath?: string): {
      insertNode(node: NewNode): void;
      close(): void;
    };
  };
}

export async function runAdd(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const typeArg = ctx.args[0];
  if (!typeArg) {
    return {
      exitCode: 2,
      text: helpText(),
    };
  }
  if (!NODE_TYPES.includes(typeArg as never)) {
    return {
      exitCode: 2,
      text: `unknown type: ${typeArg}\n  one of: ${NODE_TYPES.join(", ")}`,
    };
  }

  // Build the node from flags. Interactive Clack flow lands when --title
  // is missing AND stdin is a TTY; for now we ship the scripted path which
  // covers REPL slash flow + automation. Interactive prompts deferred to
  // a follow-up tick to avoid blocking on @clack/prompts ESM compat in the bundle.
  const title = typeof ctx.flags.title === "string" ? ctx.flags.title : null;
  if (!title) {
    return {
      exitCode: 2,
      text: [
        `--title is required (interactive mode coming in 7.3.1).`,
        ``,
        `  examples:`,
        `    mcp-graph add ${typeArg} --title "fix auth bug" --priority 2`,
        `    mcp-graph add ${typeArg} --title "Q4 epic" --priority 1 --xpSize XL`,
      ].join("\n"),
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

  const node = buildNode({
    type: typeArg,
    title,
    flags: ctx.flags,
    args: ctx.args,
    actor: process.env.USER ?? "user",
    traceId: ctx.traceId,
  });

  const validation = validate(node);
  if (validation) {
    return { exitCode: 2, text: validation };
  }

  const storeMod = (await parent.loadStore()) as StoreModule;
  const store = storeMod.SqliteStore.open(process.cwd());
  try {
    store.insertNode(node);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, text: `failed to insert node: ${msg}` };
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
        id: node.id,
        type: node.type,
        title: node.title,
        priority: node.priority,
        provenance: node.metadata.provenance,
      },
    };
  }

  return {
    exitCode: 0,
    element: <CreatedCard node={node} />,
  };
}

interface BuildArgs {
  type: string;
  title: string;
  flags: Readonly<Record<string, string | boolean>>;
  args: readonly string[];
  actor: string;
  traceId?: string;
}

function buildNode(b: BuildArgs): NewNode {
  const now = new Date().toISOString();
  const id = nodeId();
  const description = typeof b.flags.description === "string" ? b.flags.description : undefined;
  const priority = parsePriority(b.flags.priority);
  const xpSize = typeof b.flags.xpSize === "string" ? b.flags.xpSize : (typeof b.flags.size === "string" ? b.flags.size : undefined);
  const status = typeof b.flags.status === "string" ? b.flags.status : "backlog";
  const tags = parseList(b.flags.tags);
  const parentId = typeof b.flags.parent === "string" ? b.flags.parent : undefined;
  const acceptanceCriteria = parseList(b.flags.ac);
  const estimateMinutes = parseInt2(b.flags.estimate);

  const provenance: ProvenanceMeta = {
    source: "cli",
    actor: b.actor,
    cmd: `mcp-graph add ${b.type}`,
    trace_id: b.traceId,
    ts: now,
  };

  return {
    id,
    type: b.type,
    title: b.title,
    description,
    status,
    priority,
    xpSize,
    estimateMinutes,
    tags,
    parentId,
    acceptanceCriteria,
    blocked: false,
    metadata: { provenance },
    createdAt: now,
    updatedAt: now,
  };
}

function nodeId(): string {
  // Match parent project's id convention: node_<hex>
  const bytes = (globalThis.crypto?.randomUUID?.() ?? `${Math.random()}${Date.now()}`)
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 12)
    .toLowerCase()
    .padEnd(12, "0");
  return `node_${bytes}`;
}

function parsePriority(v: string | boolean | undefined): number {
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    if ((PRIORITIES as readonly number[]).includes(n)) return n;
  }
  return 3; // default medium
}

function parseInt2(v: string | boolean | undefined): number | undefined {
  if (typeof v !== "string") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseList(v: string | boolean | undefined): string[] | undefined {
  if (typeof v !== "string") return undefined;
  return v
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function validate(node: NewNode): string | null {
  if (node.title.length === 0) return "title cannot be empty";
  if (node.title.length > 500) return "title cannot exceed 500 chars";
  if (!STATUSES.includes(node.status as never)) {
    return `invalid status — one of: ${STATUSES.join(", ")}`;
  }
  if (node.xpSize && !XP_SIZES.includes(node.xpSize as never)) {
    return `invalid xpSize — one of: ${XP_SIZES.join(", ")}`;
  }
  return null;
}

function helpText(): string {
  return [
    "usage: mcp-graph add <type> --title \"…\" [flags]",
    "",
    "  types:",
    `    ${NODE_TYPES.join(", ")}`,
    "",
    "  common flags:",
    "    --title \"...\"        (required) one-line summary",
    "    --description \"...\"  long-form details",
    "    --priority N         1 (highest) … 5 (lowest)   default 3",
    "    --xpSize XS|S|M|L|XL",
    "    --status backlog|ready|in_progress|blocked|done   default backlog",
    "    --tags a,b,c",
    "    --parent node_xxx",
    "    --ac \"crit 1,crit 2\"",
    "    --estimate <minutes>",
    "    --json               JSON output",
  ].join("\n");
}

function CreatedCard({ node }: { readonly node: NewNode }): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="green">
      <Text color="green" bold>
        {t("add.created", { type: node.type })}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{`  id:    `}</Text>
        <Text>{node.id}</Text>
      </Box>
      <Box>
        <Text dimColor>{`  title: `}</Text>
        <Text>{node.title}</Text>
      </Box>
      <Box>
        <Text dimColor>{`  meta:  `}</Text>
        <Text>{`P${node.priority}${node.xpSize ? ` · ${node.xpSize}` : ""} · ${node.status}`}</Text>
      </Box>
      {node.tags && node.tags.length > 0 && (
        <Box>
          <Text dimColor>{`  tags:  `}</Text>
          <Text>{node.tags.join(", ")}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>{t("add.startHint")}</Text>
        <Text color="green">{`mcp-graph start ${node.id}`}</Text>
      </Box>
    </Box>
  );
}
