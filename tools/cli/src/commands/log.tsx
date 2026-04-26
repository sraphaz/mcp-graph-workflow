/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { existsSync, readFileSync } from "node:fs";
import { Box, Text } from "ink";
import {
  type LogQueryOptions,
  queryLogs,
} from "../core/log/query.js";
import {
  type LogEntry,
  logEvent,
  logsPath,
} from "../core/log/structured-logger.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

/**
 * `mcp-graph log` — query structured logs at `~/.mcp-graph/logs/*.jsonl`.
 *
 *   mcp-graph log                      # last 50 entries (newest first)
 *   mcp-graph log --task <id>          # filter by target task id
 *   mcp-graph log --hook <name>        # filter by hook name
 *   mcp-graph log --trace <uuid>       # all events with same trace_id
 *   mcp-graph log --since 1h           # time-windowed
 *   mcp-graph log --level error
 *   mcp-graph log --json               # raw JSONL passthrough for scripts
 */

export async function runLog(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  // Sprint 7.6 #7.6.15 — self-check that the redaction patterns in
  // structured-logger.ts actually strip what they claim to. Writes a
  // marker secret per pattern via logEvent(), reads the resulting jsonl,
  // and asserts the raw secret never appears AND the redaction marker
  // does. Surfaces a green PASS row per pattern, red FAIL on any leak.
  if (ctx.flags["redact-test"]) {
    return runRedactSelfCheck(Boolean(ctx.flags.json));
  }

  const opts: LogQueryOptions = {
    sink: pickSink(ctx.flags.sink),
    limit: parseLimit(ctx.flags.limit),
    level: pickLevel(ctx.flags.level),
    action: typeof ctx.flags.action === "string" ? ctx.flags.action : undefined,
    traceId: typeof ctx.flags.trace === "string" ? ctx.flags.trace : undefined,
    task: typeof ctx.flags.task === "string" ? ctx.flags.task : undefined,
    hook: typeof ctx.flags.hook === "string" ? ctx.flags.hook : undefined,
    since: typeof ctx.flags.since === "string" ? ctx.flags.since : undefined,
  };

  const result = queryLogs(opts);

  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        matched: result.matched,
        read: result.read,
        entries: result.entries,
      },
    };
  }

  if (result.entries.length === 0) {
    return {
      exitCode: 0,
      text: noResultsHint(opts),
    };
  }

  return {
    exitCode: 0,
    element: <LogTable entries={result.entries} />,
  };
}

function pickSink(value: string | boolean | undefined):
  | "cli"
  | "hooks"
  | "events"
  | "all"
  | undefined {
  if (
    value === "cli" ||
    value === "hooks" ||
    value === "events" ||
    value === "all"
  )
    return value;
  return undefined;
}

function pickLevel(
  value: string | boolean | undefined,
): "info" | "warn" | "error" | undefined {
  if (value === "info" || value === "warn" || value === "error") return value;
  return undefined;
}

function parseLimit(value: string | boolean | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) || n <= 0 ? undefined : n;
}

function noResultsHint(opts: LogQueryOptions): string {
  const parts: string[] = ["no log entries match the current filter."];
  if (Object.keys(opts).filter((k) => opts[k as keyof LogQueryOptions]).length === 0) {
    parts.push("logs may be empty — try running a few commands first.");
  } else {
    parts.push("try widening filters (--since 7d) or `--sink all`.");
  }
  return parts.join("\n  ");
}

function LogTable({
  entries,
}: {
  readonly entries: ReadonlyArray<LogEntry>;
}): JSX.Element {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{`logs  (showing ${entries.length})`}</Text>
      <Box flexDirection="column" marginTop={1}>
        {entries.map((e, i) => (
          <LogRow key={`${e.ts}-${i}`} entry={e} />
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>{`raw: `}</Text>
        <Text color="green">{`mcp-graph log --json`}</Text>
        <Text dimColor>{`   ·   widen: `}</Text>
        <Text color="green">--since 7d</Text>
        <Text dimColor>{` / `}</Text>
        <Text color="green">--sink all</Text>
      </Box>
    </Box>
  );
}

function LogRow({ entry }: { readonly entry: LogEntry }): JSX.Element {
  const ts = entry.ts ? entry.ts.slice(11, 19) : "??:??:??";
  const sourceColor = sourceToColor(entry.source);
  const outcomeColor = outcomeToColor(entry.outcome);
  const dur =
    entry.duration_ms !== undefined ? `${entry.duration_ms}ms`.padStart(7) : "       ";

  return (
    <Box>
      <Text dimColor>{`${ts}  `}</Text>
      <Text color={sourceColor}>{`${entry.source.padEnd(6)} `}</Text>
      <Text>{`${entry.action.padEnd(22)} `}</Text>
      <Text color={outcomeColor}>{`${(entry.outcome ?? "").padEnd(5)} `}</Text>
      <Text dimColor>{`${dur} `}</Text>
      {entry.trace_id && (
        <Text dimColor>{`${entry.trace_id.slice(0, 8)}`}</Text>
      )}
    </Box>
  );
}

function sourceToColor(source: string): string {
  switch (source) {
    case "cli":
      return "cyan";
    case "hook":
      return "magenta";
    case "mcp":
      return "blue";
    case "agent":
      return "green";
    case "graph":
      return "yellow";
    case "bridge":
      return "white";
    default:
      return "white";
  }
}

function outcomeToColor(outcome: string | undefined): string {
  switch (outcome) {
    case "ok":
      return "green";
    case "warn":
      return "yellow";
    case "error":
      return "red";
    default:
      return "white";
  }
}

// ── Sprint 7.6 #7.6.15 — redaction self-check ──────────────────────────────

interface RedactionProbe {
  readonly name: string;
  readonly secret: string;
  readonly expectedMarker: string;
}

/**
 * One probe per pattern in structured-logger.ts REDACTION_PATTERNS.
 * The `secret` is shaped to match each pattern's regex; the
 * `expectedMarker` is the replacement string the logger should emit.
 * Adding a new pattern in structured-logger.ts? Add a probe here.
 */
const PROBES: ReadonlyArray<RedactionProbe> = [
  { name: "gh-user-token (ghu_)", secret: `ghu_${"A".repeat(30)}`, expectedMarker: "<REDACTED:gh-user-token>" },
  { name: "gh-session-token (ghs_)", secret: `ghs_${"B".repeat(30)}`, expectedMarker: "<REDACTED:gh-session-token>" },
  { name: "gh-pat (ghp_)", secret: `ghp_${"C".repeat(30)}`, expectedMarker: "<REDACTED:gh-pat>" },
  { name: "anthropic-key (sk-ant-)", secret: `sk-ant-${"D".repeat(40)}`, expectedMarker: "<REDACTED:anthropic-key>" },
  { name: "openai-key (sk-)", secret: `sk-${"E".repeat(40)}`, expectedMarker: "<REDACTED:openai-key>" },
  { name: "Bearer header", secret: `Bearer ${"F".repeat(20)}.${"G".repeat(20)}`, expectedMarker: "Bearer <REDACTED>" },
  { name: "Copilot tid cookie", secret: "Cookie: tid=ABC123XYZ;", expectedMarker: "tid=<REDACTED>" },
];

interface ProbeResult {
  readonly probe: string;
  readonly leaked: boolean;
  readonly redactionApplied: boolean;
  readonly notes?: string;
}

function runRedactSelfCheck(asJson: boolean): CommandHandlerResult {
  // Use a unique marker action so we can scope the read to entries
  // this self-check produced and not the rest of cli.jsonl.
  const runId = `redact-test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const results: ProbeResult[] = [];

  for (const probe of PROBES) {
    logEvent("cli", {
      source: "cli",
      action: runId,
      ctx: { probe: probe.name, payload: probe.secret },
    });
    // Read the entries we just wrote.
    const path = logsPath("cli");
    if (!existsSync(path)) {
      results.push({ probe: probe.name, leaked: false, redactionApplied: false, notes: "log file missing — logEvent failed silently" });
      continue;
    }
    const raw = readFileSync(path, "utf8");
    // Scope to the lines for this run only.
    const matching = raw
      .split("\n")
      .filter((line) => line.includes(runId) && line.includes(probe.name));
    const tail = matching[matching.length - 1] ?? "";
    const leaked = tail.includes(probe.secret);
    const redactionApplied = tail.includes(probe.expectedMarker);
    results.push({ probe: probe.name, leaked, redactionApplied });
  }

  const anyLeak = results.some((r) => r.leaked);
  const allRedacted = results.every((r) => r.redactionApplied);
  const exitCode = anyLeak || !allRedacted ? 1 : 0;

  if (asJson) {
    return {
      exitCode,
      json: { runId, anyLeak, allRedacted, results },
    };
  }

  return {
    exitCode,
    element: <RedactCheckCard runId={runId} anyLeak={anyLeak} allRedacted={allRedacted} results={results} />,
  };
}

function RedactCheckCard({
  runId,
  anyLeak,
  allRedacted,
  results,
}: {
  readonly runId: string;
  readonly anyLeak: boolean;
  readonly allRedacted: boolean;
  readonly results: ReadonlyArray<ProbeResult>;
}): JSX.Element {
  const ok = !anyLeak && allRedacted;
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color={ok ? "green" : "red"}>
        {ok ? `✓ redaction self-check PASSED` : `✗ redaction self-check FAILED`}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{`runId: ${runId}`}</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {results.map((r) => (
          <Box key={r.probe}>
            <Text color={r.leaked ? "red" : r.redactionApplied ? "green" : "yellow"}>
              {r.leaked ? "✗ LEAK " : r.redactionApplied ? "✓ ok   " : "⚠ miss "}
            </Text>
            <Text>{r.probe}</Text>
            {r.notes && <Text dimColor>{` — ${r.notes}`}</Text>}
          </Box>
        ))}
      </Box>
      {!ok && (
        <Box marginTop={1}>
          <Text color="red">
            {anyLeak
              ? "Raw secret found in cli.jsonl — REDACTION_PATTERNS regression. Investigate structured-logger.ts."
              : "All probes ran but at least one expected marker missing — pattern may have moved/renamed."}
          </Text>
        </Box>
      )}
    </Box>
  );
}
