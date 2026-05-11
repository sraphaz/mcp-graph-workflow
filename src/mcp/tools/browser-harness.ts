/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP tool: browser_harness — atomic CDP primitives only.
 * No chat / plan / auto_heal — zero LLM code on any hot path.
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
import { HelperSignatureSchema } from "../../schemas/browser-harness.schema.js";
import { HarnessSafetyViolation, HelperValidationError } from "../../core/utils/errors.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "mcp", source: "browser-harness.ts" });

export const browserHarnessInputSchema = z.object({
  op: z.enum(["cdp", "js", "screenshot", "click", "type", "new_tab", "page_info", "wait_for_load", "helpers_add", "helpers_list", "recover"]),
  sessionId: z.string().optional(),
  method: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  code: z.string().optional(),
  selector: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  source: z.string().optional(),
  signature: HelperSignatureSchema.optional(),
  origin: z.enum(["builtin", "agent"]).optional(),
  cdpEndpoint: z.string().optional(),
});

type Input = z.infer<typeof browserHarnessInputSchema>;

const bundles = new WeakMap<SqliteStore, { registry: HelpersRegistry; runtime: HelpersRuntime; selfHeal: SelfHealService; sessions: SessionStore }>();

function getBundle(store: SqliteStore) {
  let b = bundles.get(store);
  if (!b) {
    const db = store.getDb();
    const registry = new HelpersRegistry(db);
    const runtime = new HelpersRuntime(registry);
    b = { registry, runtime, selfHeal: new SelfHealService(db, registry, runtime), sessions: new SessionStore(db) };
    seedBuiltInHelpers(b.registry);
    bundles.set(store, b);
  }
  return b;
}

export function buildBrowserHarnessHandler(store: SqliteStore) {
  return async (input: Input) => {
    const b = getBundle(store);
    try {
      const sess = input.sessionId ? b.sessions.find(input.sessionId) : null;

      switch (input.op) {
        case "cdp": {
          if (!sess) return mcpError("sessionId required or session not found");
          if (!input.method) return mcpError("method required");
          if (isCdpMethodForbidden(input.method, loadGuardrail())) return mcpError(new HarnessSafetyViolation("forbidden_cdp_method", input.method));
          return mcpText({ ok: true, result: await sess.cdp.send(input.method, input.params ?? {}) });
        }
        case "js": {
          if (!sess) return mcpError("sessionId required or session not found");
          if (!input.code) return mcpError("code required");
          const r = await sess.cdp.send("Runtime.evaluate", { expression: input.code, returnByValue: true }) as { result?: { value?: unknown } };
          return mcpText({ ok: true, value: r.result?.value });
        }
        case "screenshot": {
          if (!sess) return mcpError("sessionId required or session not found");
          const r = await sess.cdp.send("Page.captureScreenshot", { format: "png" }) as { data?: string };
          return mcpText({ ok: true, base64: r.data });
        }
        case "click": {
          if (!sess) return mcpError("sessionId required or session not found");
          if (!input.selector) return mcpError("selector required");
          return mcpText({ ok: true, result: await b.runtime.invoke(sess.cdp, "click", { selector: input.selector }) });
        }
        case "type": {
          if (!sess) return mcpError("sessionId required or session not found");
          if (!input.selector || input.text == null) return mcpError("selector and text required");
          return mcpText({ ok: true, result: await b.runtime.invoke(sess.cdp, "type_text", { selector: input.selector, text: input.text }) });
        }
        case "new_tab": {
          if (!input.cdpEndpoint) return mcpError("cdpEndpoint required");
          const cdp = new CdpClient({ endpoint: input.cdpEndpoint });
          await cdp.connect();
          return mcpText({ ok: true, sessionId: b.sessions.register(cdp, input.cdpEndpoint, null).id });
        }
        case "page_info": {
          if (!sess) return mcpError("sessionId required or session not found");
          return mcpText({ ok: true, info: await sess.cdp.send("Target.getTargetInfo", {}) });
        }
        case "wait_for_load": {
          if (!sess) return mcpError("sessionId required or session not found");
          return mcpText({ ok: true, result: await b.runtime.invoke(sess.cdp, "wait_for", { selector: input.selector ?? "body", timeoutMs: 5000 }) });
        }
        case "helpers_add": {
          if (!input.name || !input.source) return mcpError("name and source required");
          const sig = input.signature ?? { params: [], returns: "unknown" };
          const sessionId = input.sessionId ?? "mcp:helpers_add";
          try {
            const result = b.selfHeal.add({
              sessionId,
              name: input.name,
              source: input.source,
              signature: sig,
              guardrail: loadGuardrail(),
            });
            return mcpText({ ok: true, name: result.name, version: result.version });
          } catch (err) {
            if (err instanceof HelperValidationError) {
              return mcpError(`forbidden_api: ${err.message}`);
            }
            throw err;
          }
        }
        case "helpers_list":
          return mcpText({ ok: true, helpers: b.registry.list(input.origin) });
        case "recover": {
          if (!sess) return mcpError("sessionId required or session not found");
          const helper = b.registry.find("recover");
          if (!helper) return mcpText({ ok: true, message: "no recover helper registered" });
          return mcpText({ ok: true, result: await b.runtime.invoke(sess.cdp, "recover", {}) });
        }
        default:
          return mcpError("unknown op");
      }
    } catch (err) {
      log.warn("tool:browser_harness:error", { op: input.op, error: err instanceof Error ? err.message : String(err) });
      return mcpError(err instanceof Error ? err : String(err));
    }
  };
}

export function registerBrowserHarnessTool(server: McpServer, store: SqliteStore): void {
  server.tool("browser_harness", "Atomic CDP browser primitives: cdp, js, screenshot, click, type, new_tab, page_info, wait_for_load, helpers_add, helpers_list, recover.", browserHarnessInputSchema.shape, buildBrowserHarnessHandler(store));
}

export function _resetBundleCacheForTests(): void {
  // WeakMap auto-expires with the store key — no manual clear needed.
}
