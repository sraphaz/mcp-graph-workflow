/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * MCP tool: `hooks` — manage the 12 lifecycle hook channels.
 *
 * Sprint 2 (Sandbox) introduced two handler kinds:
 *
 *   kind: "shell"            (DEFAULT, recommended)
 *     params: command, commandArgs?, timeoutMs?
 *     Subprocess runs with stdin = JSON.stringify(HookEvent), stderr captured,
 *     env scrubbed (PATH, HOME, MCP_GRAPH_*). Exit code semantics mirror
 *     Claude Code hooks: 0 = pass, 2 = block (stderr → contexto), other = warn.
 *     Implementation: src/core/hooks/shell-handler.ts.
 *
 *   kind: "inline-unsafe"    (LEGACY, env-gated)
 *     params: handlerCode (string of `async (event) => {...}`)
 *     Equivalent to the pre-Sprint-2 `new Function()` path. Disabled unless
 *     MCP_GRAPH_HOOKS_INLINE_UNSAFE=true — emits an explicit security warning
 *     on every register call. Will be removed once persistent shell handlers
 *     cover the remaining inline use-cases.
 *
 * Migration: `command: "/path/to/handler.sh"` replaces every prior
 * `handlerCode: "async (e) => {...}"` registration. Adapt the script to
 * read JSON from stdin and exit 0/2/other.
 */
import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HookChannelSchema, HOOK_CHANNELS } from "../../core/hooks/hook-types.js";
import { HookRegistry } from "../../core/hooks/hook-registry.js";
import { runShellHandler, type ShellHandlerConfig } from "../../core/hooks/shell-handler.js";
import { importClaudeCodeSettings } from "../../core/hooks/claude-code-importer.js";
import { importCodexSettings } from "../../core/hooks/providers/codex.js";
import { importOpenCodeSettings } from "../../core/hooks/providers/opencode.js";
import { importCopilotSettings } from "../../core/hooks/providers/copilot.js";
import { importAiderSettings, installAiderBridge } from "../../core/hooks/providers/aider.js";
import { importContinueSettings } from "../../core/hooks/providers/continue.js";
import { importClineSettings } from "../../core/hooks/providers/cline.js";
import type { HookStatsStore } from "../../core/hooks/hook-stats-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export const HookHandlerKindSchema = z.enum(["shell", "inline-unsafe", "mjs-module"]);
export type HookHandlerKind = z.infer<typeof HookHandlerKindSchema>;

export const hooksInputSchema = z.object({
  action: z.enum(["list", "stats", "register", "unregister", "invoke", "import_claude_code", "import_codex", "import_opencode", "import_copilot", "import_aider", "import_continue", "import_cline"]),
  channel: HookChannelSchema.optional(),
  /** "shell" (default — subprocess) or "inline-unsafe" (legacy new Function, gated). */
  kind: HookHandlerKindSchema.optional(),
  /** Shell command path (kind=shell) */
  command: z.string().min(1).optional(),
  /** Shell command args (kind=shell) */
  commandArgs: z.array(z.string()).optional(),
  /** Subprocess timeout in ms (kind=shell, default 5000) */
  timeoutMs: z.number().int().positive().optional(),
  /** Inline JS handler source (kind=inline-unsafe — requires MCP_GRAPH_HOOKS_INLINE_UNSAFE=true) */
  handlerCode: z.string().min(1).optional(),
  handlerId: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  /** Path to Claude Code settings.json (action=import_claude_code; defaults to ~/.claude/settings.json) */
  source: z.string().min(1).optional(),
  /** Apply git-hook scripts when running import_aider (default false = dry-run). */
  apply: z.boolean().optional(),
  /** Project root for git-hook install (action=import_aider). Defaults to cwd. */
  basePath: z.string().min(1).optional(),
}).superRefine((val, ctx) => {
  if (val.action === "register") {
    if (!val.channel) ctx.addIssue({ code: "custom", message: "channel is required for register" });
    const kind = val.kind ?? "shell";
    if ((kind === "shell" || kind === "mjs-module") && !val.command) {
      ctx.addIssue({ code: "custom", message: `command is required for register with kind=${kind}` });
    }
    if (kind === "inline-unsafe" && !val.handlerCode) {
      ctx.addIssue({ code: "custom", message: "handlerCode is required for register with kind=inline-unsafe" });
    }
  }
  if (val.action === "unregister" && !val.handlerId) {
    ctx.addIssue({ code: "custom", message: "handlerId is required for unregister" });
  }
  if (val.action === "invoke" && !val.channel) {
    ctx.addIssue({ code: "custom", message: "channel is required for invoke" });
  }
});

export type HooksInput = z.infer<typeof hooksInputSchema>;

interface McpToolResponse {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// Module-level shared registry — persists across tool calls in a session
const sharedRegistry = new HookRegistry();
let sharedStatsStore: HookStatsStore | null = null;

/** Exposed for boot-time rehydration in server.ts. */
export function getSharedHookRegistry(): HookRegistry {
  return sharedRegistry;
}

export function setSharedHookStatsStore(store: HookStatsStore | null): void {
  sharedStatsStore = store;
  if (store) sharedRegistry.attachStatsStore(store);
}

export function getSharedHookStatsStore(): HookStatsStore | null {
  return sharedStatsStore;
}

export function buildHooksHandler(registry: HookRegistry = sharedRegistry): (input: HooksInput) => Promise<McpToolResponse> {
  return async (input: HooksInput): Promise<McpToolResponse> => {
    try {
      switch (input.action) {
        case "list": {
          const ids = registry.list();
          return mcpText({ ok: true, handlers: ids.map((id) => ({ id })), count: ids.length });
        }

        case "stats": {
          const ids = registry.list();
          const channelCounts: Record<string, number> = {};
          for (const ch of HOOK_CHANNELS) channelCounts[ch] = 0;
          const statsRows = sharedStatsStore?.list() ?? [];
          return mcpText({
            ok: true,
            totalHandlers: ids.length,
            channels: channelCounts,
            handlers: statsRows.map((s) => ({
              id: s.handlerId,
              callCount: s.callCount,
              p50DurationMs: s.p50Duration,
              p95DurationMs: s.p95Duration,
              lastError: s.lastError,
              circuitState: s.circuitState,
              updatedAt: s.updatedAt,
            })),
          });
        }

        case "register": {
          if (!input.channel) return mcpError("channel is required for register");
          const channel = input.channel;
          const id = input.handlerId ?? `hook_${Date.now()}`;
          const kind: HookHandlerKind = input.kind ?? "shell";

          if (kind === "shell" || kind === "mjs-module") {
            if (!input.command) return mcpError(`command is required for register with kind=${kind}`);
            // M3.2 (Multi-CLI PRD): mjs-module is a shim — internally runs
            // `node <file>` under the same shell-handler sandbox. Real
            // worker-thread sandbox is deferred to v2.
            const shellConfig: ShellHandlerConfig = kind === "mjs-module"
              ? {
                  id,
                  command: process.execPath,
                  args: [input.command, ...(input.commandArgs ?? [])],
                  timeoutMs: input.timeoutMs,
                }
              : {
                  id,
                  command: input.command,
                  args: input.commandArgs,
                  timeoutMs: input.timeoutMs,
                };
            const handler = async (event: Parameters<Parameters<HookRegistry["register"]>[0]["handler"]>[0]): Promise<void> => {
              const result = await runShellHandler(shellConfig, event);
              if (result.decision === "block") {
                logger.warn("hooks:shell:block", { id, channel: event.channel, stderr: result.stderr });
                throw new Error(result.stderr || `hook "${id}" blocked`);
              }
              if (result.decision === "warn") {
                logger.warn("hooks:shell:warn", { id, exitCode: result.exitCode, timedOut: result.timedOut, stderr: result.stderr });
              }
            };
            registry.register({ id, channel, handler, priority: 0 });
            logger.info("hooks:register", { id, channel, kind, command: input.command });
            return mcpText({ ok: true, handlerId: id, channel, kind });
          }

          // kind === "inline-unsafe" — gated behind explicit env opt-in.
          if (process.env.MCP_GRAPH_HOOKS_INLINE_UNSAFE !== "true") {
            return mcpError(
              "inline-unsafe handlers are disabled by default for security. " +
                "To enable, restart with MCP_GRAPH_HOOKS_INLINE_UNSAFE=true (NOT RECOMMENDED — prefer kind=shell).",
            );
          }
          if (!input.handlerCode) return mcpError("handlerCode is required for register with kind=inline-unsafe");
          logger.warn("hooks:register:inline-unsafe", { id, channel, reason: "MCP_GRAPH_HOOKS_INLINE_UNSAFE=true" });
          const fn = new Function("return " + input.handlerCode)() as (event: unknown) => Promise<void>;
          if (typeof fn !== "function") {
            return mcpError("handlerCode must evaluate to a function");
          }
          registry.register({ id, channel, handler: fn as (event: Parameters<typeof fn>[0]) => Promise<void>, priority: 0 });
          return mcpText({ ok: true, handlerId: id, channel, kind: "inline-unsafe" });
        }

        case "unregister": {
          if (!input.handlerId) return mcpError("handlerId is required for unregister");
          const id = input.handlerId;
          registry.unregister(id);
          logger.info("hooks:unregister", { id });
          return mcpText({ ok: true, handlerId: id });
        }

        case "invoke": {
          if (!input.channel) return mcpError("channel is required for invoke");
          const channel = input.channel;
          const event = { channel, timestamp: new Date().toISOString(), payload: input.payload ?? {} };
          await registry.dispatch(event);
          return mcpText({ ok: true, channel, handlersInvoked: true });
        }

        case "import_claude_code": {
          const result = importClaudeCodeSettings({ source: input.source });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            handlers: result.imported.map((h) => ({ id: h.id, channel: h.channel, matcher: h.matcher })),
            skippedDetails: result.skipped,
          });
        }

        case "import_codex": {
          const result = importCodexSettings({ source: input.source });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            handlers: result.imported.map((h) => ({ id: h.id, channel: h.channel })),
            skippedDetails: result.skipped,
          });
        }

        case "import_opencode": {
          const result = importOpenCodeSettings({ source: input.source });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            handlers: result.imported.map((h) => ({ id: h.id, channel: h.channel })),
            skippedDetails: result.skipped,
            pluginsDiscovered: result.pluginsDiscovered,
          });
        }

        case "import_copilot": {
          const result = importCopilotSettings({ source: input.source });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            handlers: result.imported.map((h) => ({ id: h.id, channel: h.channel, kind: h.kind })),
            skippedDetails: result.skipped,
          });
        }

        case "import_aider": {
          const result = importAiderSettings({ source: input.source });
          const bridge = installAiderBridge({
            basePath: input.basePath ?? process.cwd(),
            apply: input.apply ?? false,
          });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            handlers: result.imported.map((h) => ({ id: h.id, channel: h.channel })),
            skippedDetails: result.skipped,
            gitHooks: bridge,
          });
        }

        case "import_continue": {
          const result = importContinueSettings({ source: input.source });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            mcpServers: result.mcpServers,
            note: "Continue.dev: tool calls already captured via MCP path (Sprint 1.2). No native hooks to import.",
          });
        }

        case "import_cline": {
          const result = importClineSettings({ source: input.source });
          return mcpText({
            ok: true,
            provider: result.provider,
            source: result.source,
            imported: result.imported.length,
            skipped: result.skipped.length,
            mcpServers: result.mcpServers,
            note: "Cline: tool calls already captured via MCP path (Sprint 1.2). No native hooks to import.",
          });
        }
      }
    } catch (err) {
      logger.error("hooks:error", { action: input.action, error: String(err) });
      return mcpError(`hooks ${input.action} failed: ${String(err)}`);
    }
  };
}

export function registerHooks(server: McpServer): void {
  server.tool(
    "hooks",
    "Manage hook handlers — list, register, unregister, invoke, and get stats for the 12 lifecycle hook channels.",
    {
      action: z.enum(["list", "stats", "register", "unregister", "invoke", "import_claude_code", "import_codex", "import_opencode", "import_copilot", "import_aider", "import_continue", "import_cline"]).describe("Action to perform"),
      source: z.string().min(1).optional().describe("Claude Code settings.json path (action=import_claude_code)"),
      channel: HookChannelSchema.optional().describe("Hook channel (required for register/invoke)"),
      kind: HookHandlerKindSchema.optional().describe("Handler kind: 'shell' (default) or 'inline-unsafe' (gated)"),
      command: z.string().min(1).optional().describe("Shell command path (kind=shell)"),
      commandArgs: z.array(z.string()).optional().describe("Shell command args (kind=shell)"),
      timeoutMs: z.number().int().positive().optional().describe("Subprocess timeout ms (kind=shell, default 5000)"),
      handlerCode: z.string().min(1).optional().describe("Inline JS source (kind=inline-unsafe — env-gated)"),
      handlerId: z.string().min(1).optional().describe("Handler ID for unregister or register"),
      payload: z.record(z.string(), z.unknown()).optional().describe("Payload for invoke"),
    },
    async (input) => {
      const parsed = hooksInputSchema.safeParse(input);
      if (!parsed.success) {
        return mcpError(`Invalid input: ${parsed.error.message}`);
      }
      return buildHooksHandler()(parsed.data);
    },
  );
}
