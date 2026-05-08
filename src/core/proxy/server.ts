/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * MCP-Graph Proxy — HTTP server (Fase E, ADR-proxy-01..04).
 *
 * Endpoints:
 *   GET  /healthz                 → 200 { ok: true } (no auth)
 *   POST /v1/chat/completions    → OpenAI-compatible (bearer auth)
 *   GET  /v1/models              → simple list (bearer auth) — non-streaming
 *
 * Bind: 127.0.0.1 only (NFR-2). Bearer required for /v1/* (ADR-proxy-01).
 * Streaming SSE deferred to v12.1.
 *
 * Runtime: pure node:http per ADR-proxy-03 — no Fastify dep.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { LlmGateway } from "../llm/gateway.js";
import type { CallContext } from "../llm/types.js";
import {
  OpenAiChatCompletionRequestSchema,
  toLlmRequest,
  toOpenAiResponse,
} from "./openai-shape.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "server.ts" });

export interface ProxyServerOptions {
  gateway: LlmGateway;
  /** Bearer token required for /v1/* endpoints. Empty/undefined disables proxy endpoints. */
  bearerToken?: string;
  /** Default caller id for the LLM ledger when none is supplied via X-MCP-Graph-Caller. */
  defaultCaller?: string;
  /** Listen host (default 127.0.0.1 — NFR-2 local-only). */
  host?: string;
  /** Listen port (caller chooses; daemon passes via --proxy-port). */
  port: number;
  /** When true, also lists models on /v1/models. Default true. */
  listModels?: boolean;
  /** Models to list when listModels=true. Defaults: gateway.registry not exposed → caller passes. */
  models?: Array<{ id: string }>;
}

export interface ProxyServerHandle {
  server: Server;
  port: number;
  close(): Promise<void>;
}

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MiB — generous for chat payloads

/** startProxyServer — auto-generated description placeholder. */
export async function startProxyServer(opts: ProxyServerOptions): Promise<ProxyServerHandle> {
  const host = opts.host ?? "127.0.0.1";
  const server = createServer((req, res) => {
    void handleRequest(req, res, opts).catch((err) => {
      log.error("proxy:unexpected_error", { error: err instanceof Error ? err.message : String(err) });
      writeJson(res, 500, { error: { type: "internal_error", message: "internal error" } });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : opts.port;
  log.info("proxy:listening", { host, port: actualPort });

  return {
    server,
    port: actualPort,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, opts: ProxyServerOptions): Promise<void> {
  // CORS pre-flight (browser-use + Continue may CORS the proxy).
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-MCP-Graph-Caller",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // Public health.
  if (req.method === "GET" && url.pathname === "/healthz") {
    writeJson(res, 200, { ok: true });
    return;
  }

  // Authed routes.
  if (url.pathname.startsWith("/v1/")) {
    if (!opts.bearerToken) {
      writeJson(res, 503, { error: { type: "service_unavailable", message: "proxy endpoints disabled — server started without bearerToken" } });
      return;
    }
    if (!checkBearer(req, opts.bearerToken)) {
      writeJson(res, 401, { error: { type: "unauthorized", message: "missing or invalid bearer token" } });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      await handleChatCompletions(req, res, opts);
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/models" && opts.listModels !== false) {
      const models = (opts.models ?? []).map((m) => ({ id: m.id, object: "model", created: 0, owned_by: "mcp-graph" }));
      writeJson(res, 200, { object: "list", data: models });
      return;
    }
  }

  writeJson(res, 404, { error: { type: "not_found", message: `no route: ${req.method} ${url.pathname}` } });
}

async function handleChatCompletions(req: IncomingMessage, res: ServerResponse, opts: ProxyServerOptions): Promise<void> {
  let body: unknown;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    writeJson(res, 400, { error: { type: "invalid_request_error", message: `body must be JSON: ${err instanceof Error ? err.message : String(err)}` } });
    return;
  }

  const parsed = OpenAiChatCompletionRequestSchema.safeParse(body);
  if (!parsed.success) {
    writeJson(res, 400, { error: { type: "invalid_request_error", message: parsed.error.message } });
    return;
  }

  let llmReq;
  try {
    llmReq = toLlmRequest(parsed.data);
  } catch (err) {
    writeJson(res, 400, { error: { type: "invalid_request_error", message: err instanceof Error ? err.message : String(err) } });
    return;
  }

  const ctx: CallContext = {
    caller: (req.headers["x-mcp-graph-caller"] as string | undefined) ?? opts.defaultCaller ?? "openai-proxy",
  };

  try {
    const llmRes = await opts.gateway.generate(llmReq, ctx);
    const openaiRes = toOpenAiResponse(llmRes);
    writeJson(res, 200, openaiRes);
  } catch (err) {
    const status = err instanceof Error && err.name === "LlmBudgetExceededError" ? 429 : 500;
    writeJson(res, status, {
      error: {
        type: status === 429 ? "budget_exceeded" : "upstream_error",
        message: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

function checkBearer(req: IncomingMessage, expected: string): boolean {
  const auth = req.headers.authorization;
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length).trim();
  return token === expected;
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let received = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error(`body exceeds ${MAX_BODY_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(body));
}
