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
 * Challenge History Indexer — indexes challenge reports into KnowledgeStore
 * for RAG retrieval in future DESIGN phases.
 *
 * Task 4.1 (node_df89a15f8e14) — Epic: Knowledge & Alternatives
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import type { KnowledgeDocument } from "../../schemas/knowledge.schema.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface ChallengeReport {
  nodeId: string;
  title: string;
  grade: string;
  compositeScore: number;
  friction: {
    score: number;
    detectedKeywords: string[];
    justification: string;
  };
  optimality: {
    score: number;
    matchedJtbds: number;
    unmatchedJtbds: number;
  };
  reversibility: {
    score: number;
    lockInKeywords: string[];
    reversibleKeywords: string[];
  };
  tags: string[];
  timestamp: string;
}

// ── Public Functions ────────────────────────────────────

/**
 * Index a challenge report into the KnowledgeStore.
 * Creates a knowledge document with sourceType "challenge_report",
 * embedding all scoring details in the content for BM25 retrieval.
 */
export function indexChallengeReport(
  knowledgeStore: KnowledgeStore,
  report: ChallengeReport,
): KnowledgeDocument {
  const content = formatReportContent(report);

  const doc = knowledgeStore.insert({
    sourceType: "challenge_report",
    sourceId: report.nodeId,
    title: `Challenge: ${report.title} [Grade ${report.grade}]`,
    content,
    metadata: {
      nodeId: report.nodeId,
      grade: report.grade,
      compositeScore: report.compositeScore,
      tags: report.tags,
      timestamp: report.timestamp,
    },
  });

  logger.info("challenge-indexer:indexed", {
    nodeId: report.nodeId,
    grade: report.grade,
    docId: doc.id,
  });

  return doc;
}

/**
 * Search challenge history by keyword query.
 * Returns challenge reports ordered by BM25 relevance.
 */
export function searchChallengeHistory(
  knowledgeStore: KnowledgeStore,
  query: string,
  limit: number = 10,
): KnowledgeDocument[] {
  const allResults = knowledgeStore.search(query, limit * 3);

  // Filter to challenge_report source type only
  const filtered = allResults
    .filter((r) => r.sourceType === "challenge_report")
    .slice(0, limit);

  logger.debug("challenge-indexer:search", {
    query,
    totalResults: allResults.length,
    challengeResults: filtered.length,
  });

  return filtered;
}

// ── Helpers ─────────────────────────────────────────────

function formatReportContent(report: ChallengeReport): string {
  const lines = [
    `# Challenge Report: ${report.title}`,
    `Grade: ${report.grade} (${report.compositeScore}/100)`,
    `Tags: ${report.tags.join(", ")}`,
    `Timestamp: ${report.timestamp}`,
    "",
    "## Friction",
    `Score: ${report.friction.score}/100`,
    `Justification: ${report.friction.justification}`,
    report.friction.detectedKeywords.length > 0
      ? `Detected keywords: ${report.friction.detectedKeywords.join(", ")}`
      : "No friction keywords detected",
    "",
    "## Optimality",
    `Score: ${report.optimality.score}/100`,
    `Matched JTBDs: ${report.optimality.matchedJtbds}`,
    `Unmatched JTBDs: ${report.optimality.unmatchedJtbds}`,
    "",
    "## Reversibility",
    `Score: ${report.reversibility.score}/100`,
    report.reversibility.lockInKeywords.length > 0
      ? `Lock-in keywords: ${report.reversibility.lockInKeywords.join(", ")}`
      : "No lock-in indicators",
    report.reversibility.reversibleKeywords.length > 0
      ? `Reversible keywords: ${report.reversibility.reversibleKeywords.join(", ")}`
      : "No reversibility indicators",
  ];

  return lines.join("\n");
}
