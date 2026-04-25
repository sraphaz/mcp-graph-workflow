/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

import { Box, Text } from "ink";
import {
  ParentNotInstalledError,
  getParentRuntime,
} from "../core/parent-bridge.js";
import { logEvent, type LogOutcome } from "../core/log/structured-logger.js";
import type {
  CommandHandlerArgs,
  CommandHandlerResult,
} from "./registry.js";

// Sprint 7.55 #7.55.8 — Provenance harness logging.
// Detects whether the harness CLI is being driven by a human shell or by an
// agent host like Claude Code (piped stdin, no TTY). The actor field on the
// jsonl entry lets downstream replay tools tell user-initiated harness runs
// apart from agent-initiated ones without inspecting the parent process.
function detectActor(): "user" | "claude-code" {
  if (process.env.CLAUDE_CODE_AGENT === "1") return "claude-code";
  if (process.env.MCP_AGENT_HOST === "1") return "claude-code";
  if (!process.stdout.isTTY && !process.stdin.isTTY) return "claude-code";
  return "user";
}

/**
 * `mg harness <action>` — first-class CLI surface for the parent's
 * `browser_harness` MCP tool family. Same code path under the hood; the
 * difference is the user types `mg harness call <helper> --sid <id>` instead
 * of constructing an MCP `tools/call` payload.
 *
 * Actions:
 *   list                              List registered helpers
 *   start --cdp <ws-url>              Open a CDP session
 *   stop --sid <session-id>           Close a session
 *   sessions                          List active sessions
 *   call <helper> --sid <id> [--args] Invoke a helper
 *   cdp <method> --sid <id> [--params] Raw CDP method
 *   add <name> --sid <id> --source <file>  Register a helper
 *
 * `--json` works on every subaction. Mask CDP wsEndpoints in human output
 * per `.claude/rules/browser-pilot.md`.
 */

interface HarnessBundle {
  registry: {
    list(origin?: string): Array<{ name: string; origin: string; signature?: unknown }>;
    find(name: string): unknown;
  };
  runtime: {
    invoke(cdp: unknown, name: string, args: Record<string, unknown>): Promise<unknown>;
  };
  selfHeal: {
    audit(
      sessionId: string,
      action: string,
      input: Record<string, unknown>,
      result: Record<string, unknown>,
    ): void;
    add(opts: {
      sessionId: string;
      name: string;
      source: string;
      signature?: unknown;
      guardrail: unknown;
    }): unknown;
  };
  sessions: {
    register(cdp: unknown, endpoint: string, browserType: null): { id: string; cdpEndpoint: string };
    close(id: string): Promise<void>;
    get(id: string): { cdp: { send(method: string, params: Record<string, unknown>): Promise<unknown> } };
    list?(): Array<{ id: string; cdpEndpoint: string; createdAt?: string }>;
  };
}

interface BrowserHarnessModule {
  CdpClient: new (opts: { endpoint: string }) => {
    connect(): Promise<void>;
    send(method: string, params: Record<string, unknown>): Promise<unknown>;
  };
  HelpersRegistry: new (db: unknown) => HarnessBundle["registry"];
  HelpersRuntime: new (registry: HarnessBundle["registry"]) => HarnessBundle["runtime"];
  SelfHealService: new (
    db: unknown,
    registry: HarnessBundle["registry"],
    runtime: HarnessBundle["runtime"],
  ) => HarnessBundle["selfHeal"];
  SessionStore: new (db: unknown) => HarnessBundle["sessions"];
  loadGuardrail(): unknown;
  isCdpMethodForbidden(method: string, guardrail: unknown): boolean;
  seedBuiltInHelpers(registry: HarnessBundle["registry"]): void;
}

interface ParentStoreModule {
  SqliteStore: {
    open(basePath?: string): {
      getDb(): unknown;
      close(): void;
    };
  };
}

export async function runHarness(
  ctx: CommandHandlerArgs,
): Promise<CommandHandlerResult> {
  const action = ctx.args[0];
  if (!action) {
    return { exitCode: 2, text: helpText() };
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

  if (!parent.loadBrowserHarness) {
    return {
      exitCode: 127,
      text: "browser-harness module not available in the parent dist.",
    };
  }

  let storeMod: ParentStoreModule;
  let harnessMod: BrowserHarnessModule;
  try {
    [storeMod, harnessMod] = (await Promise.all([
      parent.loadStore(),
      parent.loadBrowserHarness(),
    ])) as [ParentStoreModule, BrowserHarnessModule];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exitCode: 127,
      text: [
        `failed to load parent browser-harness module: ${msg}`,
        ``,
        `  the parent's dist/ may be stale or partially built.`,
        `  rebuild it: \`npm --prefix ../.. run build\``,
        `  or pin to a known-good version: \`npm install @mcp-graph-workflow/mcp-graph@10.1.0\``,
      ].join("\n"),
    };
  }

  const store = storeMod.SqliteStore.open(process.cwd());
  try {
    const bundle = buildBundle(harnessMod, store.getDb());
    return await dispatch(action, ctx, bundle, harnessMod);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 1, text: `harness error: ${msg}` };
  } finally {
    try {
      store.close();
    } catch {
      // ignore
    }
  }
}

function buildBundle(
  mod: BrowserHarnessModule,
  db: unknown,
): HarnessBundle {
  const registry = new mod.HelpersRegistry(db);
  const runtime = new mod.HelpersRuntime(registry);
  const selfHeal = new mod.SelfHealService(db, registry, runtime);
  const sessions = new mod.SessionStore(db);
  mod.seedBuiltInHelpers(registry);
  return { registry, runtime, selfHeal, sessions };
}

async function dispatch(
  action: string,
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
  mod: BrowserHarnessModule,
): Promise<CommandHandlerResult> {
  const start = Date.now();
  let outcome: LogOutcome = "ok";
  let result: CommandHandlerResult;
  try {
    switch (action) {
      case "list":
        result = doList(ctx, bundle);
        break;
      case "start":
        result = await doStart(ctx, bundle, mod);
        break;
      case "stop":
        result = await doStop(ctx, bundle);
        break;
      case "call":
        result = await doCall(ctx, bundle);
        break;
      case "cdp":
        result = await doCdp(ctx, bundle, mod);
        break;
      case "add":
        result = await doAddHelper(ctx, bundle, mod);
        break;
      case "sessions":
        result = doSessions(ctx, bundle);
        break;
      case "inspect":
        result = doInspect(ctx);
        break;
      default:
        result = { exitCode: 2, text: `unknown action: ${action}\n${helpText()}` };
        outcome = "warn";
    }
    if (result.exitCode !== 0 && outcome === "ok") outcome = "warn";
    return result;
  } catch (err) {
    outcome = "error";
    throw err;
  } finally {
    // Sprint 7.55 #7.55.8 — every harness subaction emits a single
    // provenance entry to events.jsonl so a downstream `mg log` replay
    // can reconstruct who did what against the browser harness.
    logEvent("events", {
      source: "cli",
      actor: detectActor(),
      action: `harness:${action}`,
      duration_ms: Date.now() - start,
      outcome,
      trace_id: ctx.traceId,
    });
  }
}

function doList(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
): CommandHandlerResult {
  const filter = typeof ctx.flags.filter === "string" ? new RegExp(ctx.flags.filter) : null;
  const allHelpers = bundle.registry.list();
  const helpers = filter
    ? allHelpers.filter((h) => filter.test(h.name))
    : allHelpers;

  if (ctx.flags.json) {
    return { exitCode: 0, json: { count: helpers.length, helpers } };
  }

  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>{`browser-harness helpers  (${helpers.length})`}</Text>
        <Box flexDirection="column" marginTop={1}>
          {helpers.map((h) => (
            <Box key={h.name}>
              <Text color="cyan">{`  ${h.name.padEnd(28)} `}</Text>
              <Text dimColor>{h.origin}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    ),
  };
}

async function doStart(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
  mod: BrowserHarnessModule,
): Promise<CommandHandlerResult> {
  const cdpEndpoint = typeof ctx.flags.cdp === "string" ? ctx.flags.cdp : null;
  if (!cdpEndpoint) {
    return {
      exitCode: 2,
      text: "usage: mg harness start --cdp <ws-url>\n  hint: launch Chrome with --remote-debugging-port=9222 and copy ws://… from /json/version",
    };
  }
  const cdp = new mod.CdpClient({ endpoint: cdpEndpoint });
  await cdp.connect();
  const meta = bundle.sessions.register(cdp, cdpEndpoint, null);
  bundle.selfHeal.audit(meta.id, "start", { endpoint: cdpEndpoint }, { ok: true });

  if (ctx.flags.json) {
    return { exitCode: 0, json: { sessionId: meta.id, endpoint: maskWs(meta.cdpEndpoint) } };
  }

  return {
    exitCode: 0,
    text: `✔ session started\n  id:       ${meta.id}\n  endpoint: ${maskWs(meta.cdpEndpoint)}`,
  };
}

async function doStop(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
): Promise<CommandHandlerResult> {
  const sid = pickSid(ctx);
  if (!sid) {
    return { exitCode: 2, text: "usage: mg harness stop --sid <session-id>" };
  }
  await bundle.sessions.close(sid);
  bundle.selfHeal.audit(sid, "stop", {}, { ok: true });
  if (ctx.flags.json) {
    return { exitCode: 0, json: { ok: true, sessionId: sid } };
  }
  return { exitCode: 0, text: `✔ stopped ${sid}` };
}

async function doCall(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
): Promise<CommandHandlerResult> {
  const helperName = ctx.args[1];
  const sid = pickSid(ctx);
  if (!helperName || !sid) {
    return {
      exitCode: 2,
      text: "usage: mg harness call <helper> --sid <session-id> [--args '{\"k\":\"v\"}' | k=v ...]",
    };
  }
  // Sprint 7.55 #7.55.3 — accept either:
  //   --args '{"k":"v"}'  → parsed JSON object (legacy)
  //   k=v k2=v2 …         → positional key=value pairs after the helper name
  // The two paths produce the same shape; positional pairs override JSON
  // keys when both are present (the more-specific later flag wins).
  const jsonArgs = parseJsonFlag(ctx.flags.args) ?? {};
  const posArgs = parsePositionalKeyVals(ctx.args.slice(2));
  const args = { ...jsonArgs, ...posArgs };
  const session = bundle.sessions.get(sid);
  const result = await bundle.runtime.invoke(session.cdp, helperName, args);
  bundle.selfHeal.audit(sid, "call", { helper: helperName, args }, { ok: true });

  if (ctx.flags.json) {
    return { exitCode: 0, json: { helper: helperName, sessionId: sid, result } };
  }
  return {
    exitCode: 0,
    text: `✔ ${helperName}(${sid})\n${formatResult(result)}`,
  };
}

/**
 * Sprint 7.55 #7.55.3 — parse `key=value` positional pairs into a plain
 * object. Values are JSON-coerced (so `count=42` becomes a number,
 * `flag=true` becomes a boolean, `tags=["a","b"]` becomes an array);
 * unparseable values fall back to the raw string.
 *
 * Note: Zod-validation against the helper's input signature is deferred —
 * the helper registry currently exposes the typed signature only at the
 * registry level (HelpersRegistry.find(name).signature?), and reaching it
 * from this dispatcher requires a registry round-trip + a runtime
 * z.parse() call that the registry isn't yet shaped for. Tracked
 * separately; this task ships the parser piece, not the schema check.
 */
function parsePositionalKeyVals(tokens: ReadonlyArray<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq <= 0) continue;
    const k = tok.slice(0, eq);
    const rawV = tok.slice(eq + 1);
    let v: unknown;
    try {
      v = JSON.parse(rawV);
    } catch {
      v = rawV;
    }
    out[k] = v;
  }
  return out;
}

async function doCdp(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
  mod: BrowserHarnessModule,
): Promise<CommandHandlerResult> {
  const method = ctx.args[1];
  const sid = pickSid(ctx);
  if (!method || !sid) {
    return {
      exitCode: 2,
      text: "usage: mg harness cdp <Method.name> --sid <id> [--params '{\"k\":\"v\"}']",
    };
  }
  const guardrail = mod.loadGuardrail();
  if (mod.isCdpMethodForbidden(method, guardrail)) {
    return { exitCode: 2, text: `forbidden CDP method: ${method}` };
  }
  const params = parseJsonFlag(ctx.flags.params) ?? {};
  const session = bundle.sessions.get(sid);
  const result = await session.cdp.send(method, params);
  bundle.selfHeal.audit(sid, "cdp_raw", { method }, { ok: true });

  if (ctx.flags.json) {
    return { exitCode: 0, json: { method, sessionId: sid, result } };
  }
  return { exitCode: 0, text: `✔ ${method}\n${formatResult(result)}` };
}

async function doAddHelper(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
  mod: BrowserHarnessModule,
): Promise<CommandHandlerResult> {
  const name = ctx.args[1];
  const sid = pickSid(ctx);
  const source = typeof ctx.flags.source === "string" ? await readSource(ctx.flags.source) : null;
  const inline = typeof ctx.flags.inline === "string" ? ctx.flags.inline : null;
  if (!name || !sid || (!source && !inline)) {
    return {
      exitCode: 2,
      text: "usage: mg harness add <name> --sid <id> (--source <file> | --inline '<code>')",
    };
  }
  const guardrail = mod.loadGuardrail();
  const result = bundle.selfHeal.add({
    sessionId: sid,
    name,
    source: source ?? inline ?? "",
    guardrail,
  });
  if (ctx.flags.json) {
    return { exitCode: 0, json: { name, sessionId: sid, result } };
  }
  return { exitCode: 0, text: `✔ added helper ${name}` };
}

function doSessions(
  ctx: CommandHandlerArgs,
  bundle: HarnessBundle,
): CommandHandlerResult {
  const list = bundle.sessions.list?.() ?? [];
  if (ctx.flags.json) {
    return {
      exitCode: 0,
      json: {
        count: list.length,
        sessions: list.map((s) => ({
          id: s.id,
          endpoint: maskWs(s.cdpEndpoint),
          createdAt: s.createdAt,
        })),
      },
    };
  }

  if (list.length === 0) {
    return { exitCode: 0, text: "no active sessions. run `mg harness start --cdp <url>`." };
  }
  return {
    exitCode: 0,
    element: (
      <Box flexDirection="column" paddingX={1}>
        <Text bold>{`browser-harness sessions  (${list.length})`}</Text>
        <Box flexDirection="column" marginTop={1}>
          {list.map((s) => (
            <Box key={s.id}>
              <Text color="cyan">{`  ${s.id.padEnd(20)} `}</Text>
              <Text dimColor>{maskWs(s.cdpEndpoint)}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    ),
  };
}

function pickSid(ctx: CommandHandlerArgs): string | null {
  const fromFlag = typeof ctx.flags.sid === "string" ? ctx.flags.sid : null;
  if (fromFlag) return fromFlag;
  const fromSession = typeof ctx.flags.session === "string" ? ctx.flags.session : null;
  return fromSession;
}

function parseJsonFlag(
  v: string | boolean | undefined,
): Record<string, unknown> | null {
  if (typeof v !== "string") return null;
  try {
    const parsed = JSON.parse(v);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function readSource(path: string): Promise<string | null> {
  try {
    const fs = await import("node:fs/promises");
    return await fs.readFile(path, "utf8");
  } catch {
    return null;
  }
}

function maskWs(endpoint: string): string {
  // Per .claude/rules/browser-pilot.md: never log full CDP wsEndpoint UUIDs.
  return endpoint.replace(
    /\/devtools\/browser\/[A-Za-z0-9-]+/,
    "/devtools/browser/<redacted>",
  );
}

function formatResult(result: unknown): string {
  try {
    const s = JSON.stringify(result, null, 2);
    return s.length > 1200 ? `${s.slice(0, 1200)}…\n[truncated; use --json for full]` : s;
  } catch {
    return String(result);
  }
}

function helpText(): string {
  return [
    "usage: mg harness <action> [args]",
    "",
    "  list [--filter <regex>]                       list registered helpers",
    "  start --cdp <ws-url>                          open a CDP session",
    "  stop --sid <id>                               close a session",
    "  sessions                                      list active sessions",
    "  call <helper> --sid <id> [--args '{...}' | k=v ...] invoke a helper",
    "  cdp <method> --sid <id> [--params '{...}']    raw CDP method",
    "  add <name> --sid <id> --source <file>         register a helper from file",
    "                          --inline '<code>'      register from inline source",
    "  inspect --sid <id> [--port <p>] [--no-open]   open dashboard at",
    "                                                /browser-harness/sessions/<id>",
    "",
    "  --json on every subaction.",
  ].join("\n");
}

/**
 * Sprint 7.55 #7.55.5 — `mg harness inspect` deep-link.
 *
 * Builds the dashboard URL for a session and opens it in the user's
 * browser. Default port 3000 matches the parent's `mcp-graph serve`;
 * override via --port. Pass --no-open to print the URL only (useful
 * in CI logs and SSH sessions).
 */
function doInspect(ctx: CommandHandlerArgs): CommandHandlerResult {
  const sid = typeof ctx.flags.sid === "string" ? ctx.flags.sid : null;
  if (!sid) {
    return {
      exitCode: 2,
      text: "missing --sid <id>\n\nusage: mg harness inspect --sid <id> [--port <p>] [--no-open]",
    };
  }
  const port = typeof ctx.flags.port === "string" || typeof ctx.flags.port === "number"
    ? String(ctx.flags.port)
    : "3000";
  const url = `http://localhost:${port}/browser-harness/sessions/${encodeURIComponent(sid)}`;

  const noOpen = Boolean(ctx.flags["no-open"]);
  if (!noOpen) {
    // Best-effort browser launch; never block the command on it.
    const opener = process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    try {
      // Use spawnSync detached + ignore so the launch fires and we don't
      // hold the parent CLI on the child's lifetime.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { spawn } = require("node:child_process") as typeof import("node:child_process");
      spawn(opener, args, { stdio: "ignore", detached: true }).unref();
    } catch {
      // fall through; the URL is still printed below
    }
  }

  return { exitCode: 0, text: `harness session ${sid} → ${url}${noOpen ? "" : "\nopened in browser (use --no-open to skip)"}` };
}
