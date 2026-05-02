/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP tool: browser_harness — single tool with discriminated action union.
 * Bridges the LLM to the local CDP harness.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  CdpClient,
  HelpersRegistry,
  HelpersRuntime,
  SelfHealService,
  SessionStore,
  loadGuardrail,
  isCdpMethodForbidden,
  seedBuiltInHelpers,
} from "../../core/browser-harness/index.js";
import { mcpText, mcpError } from "../response-helpers.js";
import {
  HelperSignatureSchema,
  HelperOriginSchema,
} from "../../schemas/browser-harness.schema.js";
import {
  HarnessSafetyViolation,
  HelperNotFoundError,
} from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

interface HarnessRuntimeBundle {
  registry: HelpersRegistry;
  runtime: HelpersRuntime;
  selfHeal: SelfHealService;
  sessions: SessionStore;
}

const bundles = new WeakMap<SqliteStore, HarnessRuntimeBundle>();

function getBundle(store: SqliteStore): HarnessRuntimeBundle {
  let bundle = bundles.get(store);
  if (!bundle) {
    const db = store.getDb();
    const registry = new HelpersRegistry(db);
    const runtime = new HelpersRuntime(registry);
    const selfHeal = new SelfHealService(db, registry, runtime);
    const sessions = new SessionStore(db);
    seedBuiltInHelpers(registry);
    bundle = { registry, runtime, selfHeal, sessions };
    bundles.set(store, bundle);
  }
  return bundle;
}

/** registerBrowserHarnessTool — auto-generated description placeholder. */
export function registerBrowserHarnessTool(server: McpServer, store: SqliteStore): void {
  server.tool(
    "browser_harness",
    "Direct CDP browser harness with self-healing helpers. Actions: start, stop, call_helper, list_helpers, add_helper, cdp_raw.",
    {
      action: z.enum(["start", "stop", "call_helper", "list_helpers", "add_helper", "cdp_raw"]),
      sessionId: z.string().optional(),
      cdpEndpoint: z.string().url().optional(),
      name: z.string().optional(),
      args: z.record(z.string(), z.unknown()).optional(),
      source: z.string().optional(),
      signature: HelperSignatureSchema.optional(),
      method: z.string().optional(),
      params: z.record(z.string(), z.unknown()).optional(),
      origin: HelperOriginSchema.optional(),
    },
    async (input) => {
      const bundle = getBundle(store);
      const guardrail = loadGuardrail();

      try {
        switch (input.action) {
          case "start": {
            if (!input.cdpEndpoint) {
              return mcpError("cdpEndpoint is required (e.g. ws://127.0.0.1:9222/devtools/browser/<id>)");
            }
            const cdp = new CdpClient({ endpoint: input.cdpEndpoint });
            await cdp.connect();
            const meta = bundle.sessions.register(cdp, input.cdpEndpoint, null);
            bundle.selfHeal.audit(meta.id, "start", { endpoint: input.cdpEndpoint }, { ok: true });
            return mcpText({ ok: true, sessionId: meta.id, endpoint: meta.cdpEndpoint });
          }

          case "stop": {
            if (!input.sessionId) return mcpError("sessionId required");
            await bundle.sessions.close(input.sessionId);
            bundle.selfHeal.audit(input.sessionId, "stop", {}, { ok: true });
            return mcpText({ ok: true });
          }

          case "list_helpers": {
            const helpers = bundle.registry.list(input.origin);
            return mcpText({ ok: true, helpers });
          }

          case "call_helper": {
            if (!input.sessionId || !input.name) return mcpError("sessionId and name required");
            const session = bundle.sessions.get(input.sessionId);
            const found = bundle.registry.find(input.name);
            if (!found) {
              const err = new HelperNotFoundError(input.name);
              bundle.selfHeal.audit(input.sessionId, "call", { helper: input.name }, { error: err.message });
              return mcpError(JSON.stringify({
                code: "helper_not_found",
                helper: input.name,
                hint: "use action:add_helper with a TS function expression like 'async (cdp, args) => {...}'",
              }));
            }
            const resultValue = await bundle.runtime.invoke(session.cdp, input.name, input.args ?? {});
            bundle.selfHeal.audit(input.sessionId, "call", { helper: input.name, args: input.args ?? {} }, { ok: true });
            return mcpText({ ok: true, resultValue });
          }

          case "add_helper": {
            if (!input.sessionId || !input.name || !input.source) {
              return mcpError("sessionId, name, and source required");
            }
            const resultValue = bundle.selfHeal.add({
              sessionId: input.sessionId,
              name: input.name,
              source: input.source,
              signature: input.signature,
              guardrail,
            });
            return mcpText({ ok: true, ...resultValue });
          }

          case "cdp_raw": {
            if (!input.sessionId || !input.method) return mcpError("sessionId and method required");
            if (isCdpMethodForbidden(input.method, guardrail)) {
              const err = new HarnessSafetyViolation("forbidden_cdp_method", input.method);
              bundle.selfHeal.audit(input.sessionId, "safety_block", { method: input.method }, { error: err.message });
              return mcpError(err);
            }
            const session = bundle.sessions.get(input.sessionId);
            const resultValue = await session.cdp.send(input.method, input.params ?? {});
            bundle.selfHeal.audit(input.sessionId, "cdp_raw", { method: input.method }, { ok: true });
            return mcpText({ ok: true, resultValue });
          }
        }
      } catch (err) {
        logger.warn("tool:browser_harness:error", {
          action: input.action,
          error: err instanceof Error ? err.message : String(err),
        });
        return mcpError(err instanceof Error ? err : String(err));
      }

      return mcpError("unhandled action");
    },
  );
}

// Test-only helper to clear the bundle cache so tests don't leak state.
/** _resetBundleCacheForTests — auto-generated description placeholder. */
export function _resetBundleCacheForTests(): void {
  // WeakMap can't be cleared; nothing to do — tests create fresh stores.
}
