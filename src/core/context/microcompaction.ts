/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T01 — Microcompaction (no LLM, <1ms typical).
 * Drops old tool-result content beyond a recent window, replacing them with
 * a tiny placeholder. Idempotent — running twice produces same result.
 */

import type { ChatMessage } from "./llm-summarizer.js";

export const MICROCOMPACT_KEEP_RECENT = 8;
const PLACEHOLDER_RE = /^Old tool result \(\d+ chars\) cleared$/;

export interface MicroCompactOptions {
  keepRecent?: number;
}

function isToolResult(m: ChatMessage): boolean {
  return m.role === "tool-result";
}

function isPlaceholder(content: string): boolean {
  return PLACEHOLDER_RE.test(content);
}

export function compactByTools(
  messages: ChatMessage[],
  opts: MicroCompactOptions = {},
): ChatMessage[] {
  const keepRecent = opts.keepRecent ?? MICROCOMPACT_KEEP_RECENT;
  const indexes: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (isToolResult(messages[i])) indexes.push(i);
  }
  if (indexes.length <= keepRecent) return messages.slice();

  const droppableUntil = indexes.length - keepRecent;
  const droppableSet = new Set(indexes.slice(0, droppableUntil));

  return messages.map((m, i) => {
    if (!droppableSet.has(i)) return m;
    if (isPlaceholder(m.content)) return m; // idempotent
    return {
      role: m.role,
      content: `Old tool result (${m.content.length} chars) cleared`,
    };
  });
}
