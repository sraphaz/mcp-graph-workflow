/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-2.T04 — Agent indexer.
 *
 * Indexes agent definitions (markdown frontmatter + body) into the
 * KnowledgeStore so they're queryable via context(rag). Each agent's
 * sourceId is namespaced by its lifecycle phase (the natural memory
 * scope) so callers can filter by phase. Idempotent: KnowledgeStore
 * deduplicates by content_hash + source_id, so re-running the indexer
 * is a no-op when content is unchanged.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import type { AgentDefinition } from "../../schemas/agent.schema.js";
import { chunkText } from "./chunk-text.js";

export interface AgentIndexInput {
  agent: AgentDefinition;
  /** Raw markdown body (excluding frontmatter). Indexed as the searchable content. */
  body: string;
}

export interface AgentIndexResult {
  agentsScanned: number;
  documentsIndexed: number;
  skippedDuplicates: number;
  /** Distinct namespaces (lifecycle phases) touched in this run. */
  namespaces: string[];
}

/**
 * Build the namespaced sourceId. Format: `agent:<phase>:<name>`.
 * Two agents with the same name but different phases coexist; same
 * phase + name updates by content hash.
 */
export function agentSourceId(agent: AgentDefinition): string {
  return `agent:${agent.phase}:${agent.name}`;
}

export function indexAgents(
  store: KnowledgeStore,
  inputs: AgentIndexInput[],
): AgentIndexResult {
  let documentsIndexed = 0;
  let skippedDuplicates = 0;
  const namespaces = new Set<string>();

  for (const { agent, body } of inputs) {
    namespaces.add(agent.phase);
    const sourceId = agentSourceId(agent);
    // Compose a single canonical content blob (description + system prompt + body).
    const canonical = [
      `# ${agent.name}`,
      `Phase: ${agent.phase}`,
      `Description: ${agent.description}`,
      "",
      "## System Prompt",
      agent.systemPrompt,
      "",
      "## Body",
      body,
    ].join("\n");

    const chunks = chunkText(canonical);
    const before = store.count("agent");
    let inserted = 0;
    for (const chunk of chunks) {
      store.insert({
        sourceType: "agent",
        sourceId,
        title:
          chunks.length > 1
            ? `${agent.name} [${chunk.index + 1}/${chunks.length}]`
            : agent.name,
        content: chunk.content,
        chunkIndex: chunk.index,
        metadata: { phase: agent.phase, name: agent.name, namespace: agent.phase },
      });
      inserted++;
    }
    const after = store.count("agent");
    const newRows = after - before;
    documentsIndexed += newRows;
    skippedDuplicates += inserted - newRows;
  }

  return {
    agentsScanned: inputs.length,
    documentsIndexed,
    skippedDuplicates,
    namespaces: [...namespaces].sort(),
  };
}
