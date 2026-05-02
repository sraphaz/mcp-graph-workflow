/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-7.T03 — LLM compaction (recursive).
 * Triggers when token count > maxContext * COMPACT_THRESHOLD_RATIO.
 * Tool-call messages are preserved verbatim; only tool-result messages
 * are summarized via the injected llmFn. Recursive split with max depth
 * to bound runtime when summaries themselves overflow.
 */

export const COMPACT_THRESHOLD_RATIO = 0.8;
export const DEFAULT_MAX_RECURSION = 10;

export type Role = "system" | "user" | "assistant" | "tool-call" | "tool-result";

export interface ChatMessage {
  role: Role;
  content: string;
}

export type SummarizeFn = (text: string) => Promise<string>;
export type TokenCounter = (text: string) => number;

export interface CompactOptions {
  maxContext: number;
  thresholdRatio?: number;
  maxRecursion?: number;
  /** Per-chunk character budget when recursively splitting. */
  chunkChars?: number;
}

const DEFAULT_CHUNK_CHARS = 4000;

/** totalTokens — auto-generated description placeholder. */
export function totalTokens(messages: ChatMessage[], counter: TokenCounter): number {
  let sum = 0;
  for (const mVar of messages) sum += counter(mVar.content);
  return sum;
}

/** shouldCompact — auto-generated description placeholder. */
export function shouldCompact(
  messages: ChatMessage[],
  counter: TokenCounter,
  opts: CompactOptions,
): boolean {
  const ratio = opts.thresholdRatio ?? COMPACT_THRESHOLD_RATIO;
  return totalTokens(messages, counter) > opts.maxContext * ratio;
}

function chunk(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}

/**
 * Recursively summarize a single content block until it fits within `size`,
 * or maxRecursion exhausted.
 */
export async function recursiveCompactText(
  text: string,
  summarize: SummarizeFn,
  size: number,
  maxRecursion: number,
): Promise<string> {
  if (maxRecursion <= 0) return text;
  if (text.length <= size) return text;
  const chunks = chunk(text, size);
  const summaries = await Promise.all(chunks.map((c) => summarize(c)));
  const joined = summaries.join("\n");
  if (joined.length <= size) return joined;
  return recursiveCompactText(joined, summarize, size, maxRecursion - 1);
}

/**
 * Compact messages: keep system / user / assistant / tool-call verbatim;
 * summarize tool-result content via summarize fn.
 */
export async function llmCompact(
  messages: ChatMessage[],
  summarize: SummarizeFn,
  opts: CompactOptions,
): Promise<ChatMessage[]> {
  const chunkChars = opts.chunkChars ?? DEFAULT_CHUNK_CHARS;
  const maxRecursion = opts.maxRecursion ?? DEFAULT_MAX_RECURSION;
  const out: ChatMessage[] = [];
  for (const mVar of messages) {
    if (mVar.role !== "tool-result") {
      out.push(mVar);
      continue;
    }
    const compacted = await recursiveCompactText(mVar.content, summarize, chunkChars, maxRecursion);
    out.push({ role: "tool-result", content: compacted });
  }
  return out;
}
