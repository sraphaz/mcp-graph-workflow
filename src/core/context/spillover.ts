/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T02 — Spillover store: persist large tool-result content to disk.
 * Replaces inline content with a [SPILLOVER] reference so context windows
 * stay tight while data is recoverable via loadSpillover.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { ChatMessage } from "./llm-summarizer.js";

export const SPILLOVER_THRESHOLD_BYTES = 30 * 1024;
export const SPILLOVER_DIR_DEFAULT = "workflow-graph/spillover";

const PLACEHOLDER_RE = /^\[SPILLOVER\] path=(.+?) size=(\d+)$/;

export interface SpilloverInput {
  sessionId: string;
  toolName?: string;
  threshold?: number;
  rootDir?: string;
  now?: () => number;
}

export interface SpilloverResult {
  spilled: boolean;
  message: ChatMessage;
  path?: string;
  bytes?: number;
}

function buildPath(opts: SpilloverInput): string {
  const root = opts.rootDir ?? SPILLOVER_DIR_DEFAULT;
  const ts = (opts.now ?? Date.now)();
  const tool = opts.toolName ?? "unknown";
  const suffix = Math.random().toString(36).slice(2, 7);
  return join(root, opts.sessionId, `${tool}-${ts}-${suffix}.json`);
}

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Persist `message.content` to disk if its byte length exceeds threshold,
 * returning a new ChatMessage with the placeholder. Otherwise returns the
 * original message untouched.
 */
export function spillover(message: ChatMessage, opts: SpilloverInput): SpilloverResult {
  const threshold = opts.threshold ?? SPILLOVER_THRESHOLD_BYTES;
  const bytes = Buffer.byteLength(message.content, "utf-8");
  if (bytes <= threshold) {
    return { spilled: false, message };
  }
  const path = buildPath(opts);
  ensureDir(path);
  writeFileSync(path, message.content, "utf-8");
  return {
    spilled: true,
    bytes,
    path,
    message: {
      role: message.role,
      content: `[SPILLOVER] path=${path} size=${bytes}`,
    },
  };
}

/**
 * Hydrate a [SPILLOVER] placeholder back into the original content. Returns
 * undefined when the message isn't a placeholder or the file is missing.
 */
export function loadSpillover(content: string): string | undefined {
  const m = PLACEHOLDER_RE.exec(content);
  if (!m) return undefined;
  const path = m[1];
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}

/** Cheap test for "does this content reference a spilled file?" */
export function isSpilloverPlaceholder(content: string): boolean {
  return PLACEHOLDER_RE.test(content);
}
