/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * This file is part of mcp-graph.
 *
 * mcp-graph is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License v3.0 or later, as published by
 * the Free Software Foundation. See LICENSE for the full terms.
 *
 * mcp-graph is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE.
 *
 * Commercial licenses are available — see COMMERCIAL.md.
 */

/**
 * Interdisciplinary Knowledge Intersector — discovers cross-domain intersections
 * between knowledge documents from different source types.
 *
 * Analyzes tag overlap, entity co-occurrence, and TF-IDF keyword similarity
 * across source type groups to surface novel connections and suggest new skills.
 */

import type Database from "better-sqlite3";
import type { KnowledgeDocument } from "../../schemas/knowledge.schema.js";
import { KnowledgeStore } from "../store/knowledge-store.js";
import { jaccardSimilarity } from "../utils/similarity.js";
import { TfIdfIndex } from "../search/tfidf.js";
import { extractEntitiesFromText } from "../rag/entity-extractor.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "interdisciplinary-intersector.ts" });

function safeParseJson(raw: string | null | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return undefined; }
}

// ── Types ──────────────────────────────────────────────────

export interface IntersectionCandidate {
  sourceTypeA: string;
  sourceTypeB: string;
  sharedTags: string[];
  sharedEntities: string[];
  tagOverlapScore: number;
  entityOverlapScore: number;
  keywordSimilarity: number;
  combinedScore: number;
  sampleDocsA: string[];
  sampleDocsB: string[];
}

export interface IntersectionInsight {
  id: string;
  domains: [string, string];
  sharedConcepts: string[];
  score: number;
  suggestedSkillName: string;
  suggestedSkillDescription: string;
  sourceDocCount: number;
  createdAt: string;
}

export interface IntersectOptions {
  concept?: string;
  minScore?: number;
  limit?: number;
}

// ── Internal helpers ────────────────────────────────────────

interface DocGroup {
  sourceType: string;
  docs: Array<{ title: string; content: string; metadata: Record<string, unknown> | null }>;
  allTags: Set<string>;
  allEntities: Set<string>;
  combinedText: string;
}

const MIN_DOCS_PER_GROUP = 2;
const DEFAULT_MIN_SCORE = 0.15;
const DEFAULT_LIMIT = 10;
const MAX_SAMPLE_DOCS = 3;

// Weights for combined score
const TAG_WEIGHT = 0.35;
const ENTITY_WEIGHT = 0.35;
const KEYWORD_WEIGHT = 0.30;

function buildGroups(db: Database.Database): DocGroup[] {
  const rows = db
    .prepare(
      "SELECT source_type, title, content, metadata FROM knowledge_documents ORDER BY source_type",
    )
    .all() as Array<{
      source_type: string;
      title: string;
      content: string;
      metadata: string | null;
    }>;

  const byType = new Map<string, DocGroup>();

  for (const row of rows) {
    let meta: Record<string, unknown> | null = null;
    if (row.metadata) {
      try { meta = JSON.parse(row.metadata) as Record<string, unknown>; } catch (e) { log.debug("intentional swallow", { error: e, reason: "corrupted metadata, skip deserialization" }); }
    }
    let group = byType.get(row.source_type);
    if (!group) {
      group = {
        sourceType: row.source_type,
        docs: [],
        allTags: new Set(),
        allEntities: new Set(),
        combinedText: "",
      };
      byType.set(row.source_type, group);
    }

    group.docs.push({ title: row.title, content: row.content, metadata: meta });

    // Collect tags
    const tags = meta?.tags;
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (typeof tag === "string") group.allTags.add(tag.toLowerCase());
      }
    }

    // Extract entities from content
    const entities = extractEntitiesFromText(`${row.title} ${row.content}`);
    for (const entity of entities) {
      group.allEntities.add(entity.name);
    }

    group.combinedText += ` ${row.title} ${row.content}`;
  }

  return [...byType.values()];
}

function computeKeywordSimilarity(textA: string, textB: string): number {
  const index = new TfIdfIndex();
  index.addDocument("a", textA);
  index.addDocument("b", textB);

  // Query group A text against the index — score for doc "b" indicates similarity
  const results = index.search(textA, 2);
  const bResult = results.find((r) => r.id === "b");
  if (!bResult || bResult.score <= 0) return 0;

  // Normalize: TF-IDF scores vary widely, cap at 1.0
  const maxScore = results.reduce((max, r) => Math.max(max, r.score), 0);
  return maxScore > 0 ? Math.min(bResult.score / maxScore, 1.0) : 0;
}

function groupMatchesConcept(group: DocGroup, concept: string): boolean {
  const lc = concept.toLowerCase();
  // Check tags
  if (group.allTags.has(lc)) return true;
  // Check entities
  for (const entity of group.allEntities) {
    if (entity.toLowerCase().includes(lc)) return true;
  }
  // Check combined text
  if (group.combinedText.toLowerCase().includes(lc)) return true;
  return false;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Discover intersections between knowledge document groups from different source types.
 */
export function computeIntersections(
  db: Database.Database,
  options?: IntersectOptions,
): IntersectionCandidate[] {
  const minScore = options?.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const concept = options?.concept;

  const groups = buildGroups(db).filter((g) => g.docs.length >= MIN_DOCS_PER_GROUP);

  if (groups.length < 2) {
    log.info("intersector:skip", { reason: "fewer than 2 source type groups", groupCount: groups.length });
    return [];
  }

  const candidates: IntersectionCandidate[] = [];

  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const groupA = groups[i];
      const groupB = groups[j];

      // If concept filter provided, at least one group must match
      if (concept && !groupMatchesConcept(groupA, concept) && !groupMatchesConcept(groupB, concept)) {
        continue;
      }

      // Tag overlap (Jaccard)
      const tagOverlapScore = jaccardSimilarity(groupA.allTags, groupB.allTags);
      const sharedTags = [...groupA.allTags].filter((t) => groupB.allTags.has(t));

      // Entity overlap (Jaccard)
      const entityOverlapScore = jaccardSimilarity(groupA.allEntities, groupB.allEntities);
      const sharedEntities = [...groupA.allEntities].filter((e) => groupB.allEntities.has(e));

      // Keyword similarity (TF-IDF)
      const keywordSimilarity = computeKeywordSimilarity(groupA.combinedText, groupB.combinedText);

      // Combined score
      const combinedScore =
        TAG_WEIGHT * tagOverlapScore +
        ENTITY_WEIGHT * entityOverlapScore +
        KEYWORD_WEIGHT * keywordSimilarity;

      if (combinedScore < minScore) continue;

      candidates.push({
        sourceTypeA: groupA.sourceType,
        sourceTypeB: groupB.sourceType,
        sharedTags,
        sharedEntities,
        tagOverlapScore,
        entityOverlapScore,
        keywordSimilarity,
        combinedScore,
        sampleDocsA: groupA.docs.slice(0, MAX_SAMPLE_DOCS).map((d) => d.title),
        sampleDocsB: groupB.docs.slice(0, MAX_SAMPLE_DOCS).map((d) => d.title),
      });
    }
  }

  candidates.sort((a, b) => b.combinedScore - a.combinedScore);

  const capped = candidates.slice(0, limit);
  log.info("intersector:computed", { total: candidates.length, returned: capped.length });
  return capped;
}

/**
 * Generate and store intersection insights as synthesis documents.
 */
export function generateIntersectionInsights(
  db: Database.Database,
  candidates: IntersectionCandidate[],
): IntersectionInsight[] {
  if (candidates.length === 0) return [];

  const store = new KnowledgeStore(db);
  const insights: IntersectionInsight[] = [];

  for (const candidate of candidates) {
    const { sourceTypeA, sourceTypeB } = candidate;
    const sharedConcepts = [...candidate.sharedTags, ...candidate.sharedEntities];
    const uniqueConcepts = [...new Set(sharedConcepts)].slice(0, 10);

    const suggestedSkillName = `${sourceTypeA}-${sourceTypeB}-integrator`;
    const suggestedSkillDescription =
      `Cross-domain skill integrating knowledge from ${sourceTypeA} and ${sourceTypeB}. ` +
      `Shared concepts: ${uniqueConcepts.join(", ") || "keyword overlap"}. ` +
      `Score: ${candidate.combinedScore.toFixed(3)}.`;

    const content = [
      `# Intersection: ${sourceTypeA} x ${sourceTypeB}`,
      "",
      `## Score: ${candidate.combinedScore.toFixed(3)}`,
      `- Tag overlap: ${candidate.tagOverlapScore.toFixed(3)}`,
      `- Entity overlap: ${candidate.entityOverlapScore.toFixed(3)}`,
      `- Keyword similarity: ${candidate.keywordSimilarity.toFixed(3)}`,
      "",
      `## Shared Concepts`,
      ...uniqueConcepts.map((c) => `- ${c}`),
      "",
      `## Sample Documents (${sourceTypeA})`,
      ...candidate.sampleDocsA.map((t) => `- ${t}`),
      "",
      `## Sample Documents (${sourceTypeB})`,
      ...candidate.sampleDocsB.map((t) => `- ${t}`),
      "",
      `## Suggested Skill`,
      `- **Name:** ${suggestedSkillName}`,
      `- **Description:** ${suggestedSkillDescription}`,
      "",
      `## Next Steps`,
      `1. Review shared concepts for novel integration opportunities`,
      `2. Create a detailed skill specification based on this intersection`,
      `3. Use write_memory to save promising patterns discovered`,
    ].join("\n");

    const sourceId = `synthesis:intersection:${sourceTypeA}:${sourceTypeB}`;
    const sourceDocCount = candidate.sampleDocsA.length + candidate.sampleDocsB.length;

    const doc = store.insert({
      sourceType: "synthesis",
      sourceId,
      title: `Intersection: ${sourceTypeA} x ${sourceTypeB}`,
      content,
      metadata: {
        strategy: "interdisciplinary_intersection",
        domains: [sourceTypeA, sourceTypeB],
        sharedConcepts: uniqueConcepts,
        score: candidate.combinedScore,
        suggestedSkillName,
        sourceDocCount,
        indexedAt: new Date().toISOString(),
      },
    });

    insights.push({
      id: doc.id,
      domains: [sourceTypeA, sourceTypeB],
      sharedConcepts: uniqueConcepts,
      score: candidate.combinedScore,
      suggestedSkillName,
      suggestedSkillDescription,
      sourceDocCount,
      createdAt: doc.createdAt,
    });
  }

  log.info("intersector:insights_generated", { count: insights.length });
  return insights;
}

/**
 * List previously generated intersection insights.
 */
export function listIntersections(
  db: Database.Database,
  limit: number = 20,
): KnowledgeDocument[] {
  const rows = db
    .prepare(
      `SELECT id, source_type, source_id, title, content, content_hash, chunk_index, metadata, created_at, updated_at
       FROM knowledge_documents
       WHERE source_id LIKE 'synthesis:intersection:%'
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as Array<{
      id: string;
      source_type: string;
      source_id: string;
      title: string;
      content: string;
      content_hash: string;
      chunk_index: number;
      metadata: string | null;
      created_at: string;
      updated_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type as KnowledgeDocument["sourceType"],
    sourceId: row.source_id,
    title: row.title,
    content: row.content,
    contentHash: row.content_hash,
    chunkIndex: row.chunk_index,
    metadata: safeParseJson(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a specific intersection insight by ID.
 */
export function getIntersectionDetail(
  db: Database.Database,
  docId: string,
): KnowledgeDocument | null {
  const store = new KnowledgeStore(db);
  return store.getById(docId);
}
