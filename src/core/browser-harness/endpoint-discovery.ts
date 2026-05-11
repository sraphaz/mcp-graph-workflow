/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-browser-harness — Task 2.2: wsEndpoint discovery.
 * Reads DevToolsActivePort (Chrome 144+) or probes /json/version.
 * Never spawns Chrome. Polls up to timeoutMs. Masks wsEndpoint in logs.
 */

import * as fs from "node:fs/promises";
import * as http from "node:http";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DiscoveredEndpoint {
  wsEndpoint: string;
  port: number;
  source: "devtools_active_port" | "json_version";
}

export interface DiscoveryOptions {
  host?: string;
  port?: number;
  portFilePath?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface DiscoveryDeps {
  readFileAt: (path: string) => Promise<string | null>;
  httpGetJson: (url: string) => Promise<string | null>;
  sleep: (ms: number) => Promise<void>;
}

export class CdpUnreachableError extends Error {
  readonly code = "cdp_unreachable" as const;
  readonly hint: string;

  constructor(hint: string) {
    super(`CDP endpoint unreachable: ${hint}`);
    this.name = "CdpUnreachableError";
    this.hint = hint;
  }
}

// ─── Pure helpers ──────────────────────────────────────────────────────────────

/** Mask the per-session UUID in a DevTools WS URL — §browser-pilot-rules. */
export function maskWsEndpoint(wsUrl: string): string {
  return wsUrl.replace(
    /(?<=\/devtools\/browser\/)(?!<redacted>)[^/\s]+/,
    "<redacted>",
  );
}

/** Parse a DevToolsActivePort file (two-line format: port\npath). */
export function parseDevToolsActivePort(
  content: string,
): { port: number; path: string } | null {
  const lines = content.split("\n").map((l) => l.trim());
  const port = parseInt(lines[0] ?? "", 10);
  const path = lines[1] ?? "";
  if (Number.isNaN(port) || port <= 0 || !path) return null;
  return { port, path };
}

function defaultPortFilePath(): string {
  if (process.platform === "darwin")
    return `${process.env["HOME"]}/Library/Application Support/Google/Chrome/DevToolsActivePort`;
  if (process.platform === "win32")
    return `${process.env["LOCALAPPDATA"]}\\Google\\Chrome\\User Data\\DevToolsActivePort`;
  return `${process.env["HOME"]}/.config/google-chrome/DevToolsActivePort`;
}

// ─── Default I/O deps ──────────────────────────────────────────────────────────

const defaultDeps: DiscoveryDeps = {
  readFileAt: async (path) => {
    try {
      return await fs.readFile(path, "utf8");
    } catch {
      return null;
    }
  },

  httpGetJson: (url) =>
    new Promise((resolve) => {
      const req = http.get(url, { timeout: 3000 }, (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => { resolve(res.statusCode === 200 ? body : null); });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
    }),

  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

// ─── Discovery ─────────────────────────────────────────────────────────────────

function extractWsUrl(jsonBody: string): string | null {
  try {
    const parsed: unknown = JSON.parse(jsonBody);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "webSocketDebuggerUrl" in parsed &&
      typeof (parsed as Record<string, unknown>)["webSocketDebuggerUrl"] === "string"
    ) {
      return (parsed as Record<string, unknown>)["webSocketDebuggerUrl"] as string;
    }
  } catch (_err) {
    void _err; // malformed JSON — not a valid response
  }
  return null;
}

/**
 * Discover the Chrome CDP wsEndpoint by:
 *   1. Reading DevToolsActivePort → probing /json/version
 *   2. Fallback: probing /json/version at the specified port
 * Polls up to timeoutMs (default 30s). Never spawns Chrome.
 */
export async function discoverWsEndpoint(
  options: DiscoveryOptions = {},
  deps: DiscoveryDeps = defaultDeps,
): Promise<DiscoveredEndpoint> {
  const host = options.host ?? "127.0.0.1";
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  const portFilePath = options.portFilePath ?? defaultPortFilePath();

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Attempt 1: DevToolsActivePort file
    const portFileContent = await deps.readFileAt(portFilePath);
    if (portFileContent) {
      const parsed = parseDevToolsActivePort(portFileContent);
      if (parsed) {
        const url = `http://${host}:${parsed.port}/json/version`;
        const body = await deps.httpGetJson(url);
        if (body) {
          const wsEndpoint = extractWsUrl(body);
          if (wsEndpoint) {
            return { wsEndpoint, port: parsed.port, source: "devtools_active_port" };
          }
        }
      }
    }

    // Attempt 2: direct /json/version at explicit port
    if (options.port !== undefined) {
      const url = `http://${host}:${options.port}/json/version`;
      const body = await deps.httpGetJson(url);
      if (body) {
        const wsEndpoint = extractWsUrl(body);
        if (wsEndpoint) {
          return { wsEndpoint, port: options.port, source: "json_version" };
        }
      }
    }

    await deps.sleep(pollIntervalMs);
  }

  throw new CdpUnreachableError(
    `Chrome with remote debugging not found after ${timeoutMs}ms. ` +
    `Start Chrome with --remote-debugging-port=9222 and try again.`,
  );
}
