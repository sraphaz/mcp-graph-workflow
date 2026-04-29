/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T04 — Emergency summarizer (deterministic, no LLM, <10ms).
 * Used by the compaction pipeline when the LLM circuit breaker is open.
 * Strategy: keep markdown headings + first sentence of each paragraph,
 * yielding a compact extractive summary.
 */

import type { ChatMessage } from "./llm-summarizer.js";

const HEADING_RE = /^\s{0,3}#{1,6}\s+.+$/;
const SENTENCE_RE = /[^.!?]+[.!?]+/;

function summarizeText(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (HEADING_RE.test(line)) {
      out.push(line.trim());
    }
  }

  const paragraphs = text.split(/\n{2,}/);
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed || HEADING_RE.test(trimmed)) continue;
    const match = SENTENCE_RE.exec(trimmed);
    if (match) {
      out.push(match[0].trim());
    } else {
      // No sentence terminator — take first 200 chars.
      out.push(trimmed.slice(0, 200));
    }
  }
  return out.length > 0 ? out.join("\n") : text.slice(0, 200);
}

/**
 * Apply emergency summarization to tool-result messages only. Other roles
 * (system, user, assistant, tool-call) pass through verbatim.
 */
export function emergencyCompact(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (m.role !== "tool-result") return m;
    return { role: m.role, content: summarizeText(m.content) };
  });
}

export { summarizeText as emergencySummarize };
