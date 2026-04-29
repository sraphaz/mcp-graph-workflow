/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T06 — Compaction pipeline.
 * Orchestrates 4 levels of compaction in order:
 *   1) micro     — drop redundant/duplicated messages
 *   2) spillover — fold older messages into a single summary block
 *   3) llm       — invoke LLM-based summarization (T03)
 *   4) emergency — hard truncate to last N messages
 *
 * Stops at the first level that brings tokens within the target. Returns
 * structured metrics so the caller can persist into context_compaction_log.
 */

import type { ChatMessage, SummarizeFn, TokenCounter } from "./llm-summarizer.js";
import { llmCompact, totalTokens } from "./llm-summarizer.js";

export type CompactionLevel = "micro" | "spillover" | "llm" | "emergency";

export interface PipelineOptions {
  maxContext: number;
  /** Target ratio after compaction (default 0.6 of maxContext). */
  targetRatio?: number;
  counter: TokenCounter;
  summarize: SummarizeFn;
  /** Last-N messages preserved by emergency truncation (default 6). */
  emergencyKeepLast?: number;
}

export interface PipelineMetrics {
  levelUsed: CompactionLevel | "none";
  tokensBefore: number;
  tokensAfter: number;
  durationMs: number;
  levelsTried: CompactionLevel[];
}

export interface PipelineResult {
  messages: ChatMessage[];
  metrics: PipelineMetrics;
}

const DEFAULT_TARGET_RATIO = 0.6;
const DEFAULT_EMERGENCY_KEEP = 6;

export function microCompact(messages: ChatMessage[]): ChatMessage[] {
  // Drop exact-duplicate adjacent tool-result messages — common after retries.
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.role === m.role &&
      m.role === "tool-result" &&
      prev.content === m.content
    ) {
      continue;
    }
    out.push(m);
  }
  return out;
}

export function spilloverCompact(
  messages: ChatMessage[],
  keepRecent: number = 4,
): ChatMessage[] {
  if (messages.length <= keepRecent) return messages;
  const olderEnd = messages.length - keepRecent;
  const older = messages.slice(0, olderEnd);
  const recent = messages.slice(olderEnd);
  if (older.length === 0) return recent;
  const summary: ChatMessage = {
    role: "system",
    content: `[spillover-summary: ${older.length} earlier messages folded]`,
  };
  return [summary, ...recent];
}

export function emergencyTruncate(
  messages: ChatMessage[],
  keepLast: number,
): ChatMessage[] {
  if (messages.length <= keepLast) return messages;
  const truncated = messages.slice(messages.length - keepLast);
  return [
    { role: "system", content: "[emergency-truncate: prior messages dropped]" },
    ...truncated,
  ];
}

function isWithin(messages: ChatMessage[], target: number, counter: TokenCounter): boolean {
  return totalTokens(messages, counter) <= target;
}

export async function compactionPipeline(
  messages: ChatMessage[],
  opts: PipelineOptions,
): Promise<PipelineResult> {
  const start = Date.now();
  const targetRatio = opts.targetRatio ?? DEFAULT_TARGET_RATIO;
  const target = opts.maxContext * targetRatio;
  const tokensBefore = totalTokens(messages, opts.counter);
  const triedLevels: CompactionLevel[] = [];

  if (tokensBefore <= target) {
    return {
      messages,
      metrics: {
        levelUsed: "none",
        tokensBefore,
        tokensAfter: tokensBefore,
        durationMs: Date.now() - start,
        levelsTried: triedLevels,
      },
    };
  }

  let levelUsed: CompactionLevel | "none" = "none";

  // 1) micro
  triedLevels.push("micro");
  let current = microCompact(messages);
  if (isWithin(current, target, opts.counter)) levelUsed = "micro";

  // 2) spillover
  if (levelUsed === "none") {
    triedLevels.push("spillover");
    current = spilloverCompact(current);
    if (isWithin(current, target, opts.counter)) levelUsed = "spillover";
  }

  // 3) llm
  if (levelUsed === "none") {
    triedLevels.push("llm");
    current = await llmCompact(current, opts.summarize, { maxContext: opts.maxContext });
    if (isWithin(current, target, opts.counter)) levelUsed = "llm";
  }

  // 4) emergency
  if (levelUsed === "none") {
    triedLevels.push("emergency");
    current = emergencyTruncate(current, opts.emergencyKeepLast ?? DEFAULT_EMERGENCY_KEEP);
    levelUsed = "emergency";
  }

  return {
    messages: current,
    metrics: {
      levelUsed,
      tokensBefore,
      tokensAfter: totalTokens(current, opts.counter),
      durationMs: Date.now() - start,
      levelsTried: triedLevels,
    },
  };
}
