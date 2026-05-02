/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §PRD-mcp-graph-proxy — CLI action handlers.
 *
 * Pure orchestration over the bearer-token module + filesystem. The Ink
 * command in tools/cli/src/commands/proxy.tsx wraps these handlers with
 * react/ink rendering; tests target this module directly so they stay
 * deterministic and decoupled from terminal rendering.
 *
 * Token file: $HOME/.mcp-graph/proxy.token (mode 0600). Stores a JSON
 * BearerStore so callers can rotate without losing the previous token
 * during the grace window.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  statSync,
} from "node:fs";
import { dirname } from "node:path";
import {
  generateBearer,
  rotateBearer,
  isExpired,
  DEFAULT_TTL_MS,
  type BearerStore,
} from "./bearer-token.js";

export interface ProxyCliEnv {
  tokenPath: string;
  /** Optional clock injection for deterministic tests. */
  now?: () => number;
}

export interface TokenActionResult {
  action: "token";
  rotated: boolean;
  activeTokenPreview: string;
  previousTokenPreview?: string;
  path: string;
}

export interface StatusActionResult {
  action: "status";
  exists: boolean;
  expired: boolean;
  fileMode?: string;
  path: string;
  activeTokenPreview?: string;
}

export interface SimpleActionResult {
  action: "start" | "stop";
  ok: boolean;
  message: string;
}

export type ProxyCliResult =
  | TokenActionResult
  | StatusActionResult
  | SimpleActionResult;

function preview(token: string): string {
  return `${token.slice(0, 10)}…${token.slice(-4)}`;
}

function readStore(path: string): BearerStore | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as BearerStore;
  } catch {
    return undefined;
  }
}

function writeStore(path: string, store: BearerStore): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), { encoding: "utf-8" });
  try {
    chmodSync(path, 0o600);
  } catch {
    // best-effort on platforms without POSIX perms (Windows)
  }
}

/**
 * Generate (or rotate) the bearer token. If no token exists yet, creates a
 * fresh one. If a token already exists, rotates it and keeps the prior
 * value as `previous` so in-flight requests don't break.
 */
export function tokenAction(env: ProxyCliEnv): TokenActionResult {
  const now = env.now ?? Date.now;
  const existing = readStore(env.tokenPath);
  let store: BearerStore;
  let rotated: boolean;
  if (!existing) {
    store = { active: generateBearer(now(), DEFAULT_TTL_MS) };
    rotated = false;
  } else {
    store = rotateBearer(existing, now(), DEFAULT_TTL_MS);
    rotated = true;
  }
  writeStore(env.tokenPath, store);
  return {
    action: "token",
    rotated,
    activeTokenPreview: preview(store.active.token),
    previousTokenPreview: store.previous ? preview(store.previous.token) : undefined,
    path: env.tokenPath,
  };
}

/** Inspect the token file: present? mode 0600? expired? */
export function statusAction(env: ProxyCliEnv): StatusActionResult {
  const now = env.now ?? Date.now;
  if (!existsSync(env.tokenPath)) {
    return { action: "status", exists: false, expired: false, path: env.tokenPath };
  }
  const store = readStore(env.tokenPath);
  let mode: string | undefined;
  try {
    const st = statSync(env.tokenPath);
    mode = (st.mode & 0o777).toString(8).padStart(3, "0");
  } catch {
    // ignore
  }
  if (!store) {
    return { action: "status", exists: true, expired: false, fileMode: mode, path: env.tokenPath };
  }
  return {
    action: "status",
    exists: true,
    expired: isExpired(store.active, now()),
    fileMode: mode,
    path: env.tokenPath,
    activeTokenPreview: preview(store.active.token),
  };
}

/**
 * `start` and `stop` are surface-only here — the actual long-running HTTP
 * server lives in src/core/proxy/server.ts and is launched by the CLI's
 * process layer (out of scope for the pure orchestration module). Returns
 * an instructive payload so the CLI can render a hint.
 */
export function startActionStub(): SimpleActionResult {
  return {
    action: "start",
    ok: true,
    message:
      "Proxy server start is wired in tools/cli/src/commands/proxy.tsx (long-running). Use `mcp-graph proxy token` first to ensure a bearer is provisioned.",
  };
}

/** stopActionStub — auto-generated description placeholder. */
export function stopActionStub(): SimpleActionResult {
  return {
    action: "stop",
    ok: true,
    message: "Proxy stop is wired in tools/cli/src/commands/proxy.tsx (sends SIGTERM to the running PID).",
  };
}
