/**
 * Alternative Suggestion Engine — suggests alternatives when a decision
 * fails the ADR challenge. Queries past successful challenges from
 * KnowledgeStore and ranks by estimated fitness score.
 *
 * Pure functions, deterministic. No LLM dependency.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import type { ChallengeReport } from "../rag/challenge-indexer.js";
import { searchChallengeHistory } from "../rag/challenge-indexer.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface ScoreDelta {
  composite: number;
  friction: number;
  optimality: number;
  reversibility: number;
}

export interface AlternativeSuggestion {
  title: string;
  sourceNodeId: string;
  estimatedScore: number;
  grade: string;
  scoreDelta: ScoreDelta;
  tradeOffs: string[];
}

const PASS_THRESHOLD = 60;

// ── Public Functions ────────────────────────────────────

/**
 * Suggest alternatives for a failed challenge decision.
 *
 * Searches KnowledgeStore for past challenges with similar tags/keywords,
 * filters to those that passed (score >= 60), excludes the same decision,
 * and returns ranked alternatives with score deltas.
 */
export function suggestAlternatives(
  failedReport: ChallengeReport,
  knowledgeStore: KnowledgeStore,
  limit: number = 5,
): AlternativeSuggestion[] {
  logger.info("alternative-suggester:search", {
    nodeId: failedReport.nodeId,
    compositeScore: failedReport.compositeScore,
    tags: failedReport.tags,
  });

  // Build search query from tags and title keywords (FTS5 OR for broader matching)
  const queryParts = [
    ...failedReport.tags,
    ...failedReport.title.split(/\s+/).filter((w) => w.length > 3),
  ];

  if (queryParts.length === 0) return [];

  // Use FTS5 OR syntax to match any keyword (broader recall)
  const query = queryParts.join(" OR ");

  // Search for past challenge reports
  const results = searchChallengeHistory(knowledgeStore, query, limit * 3);

  // Parse and filter results
  const suggestions: AlternativeSuggestion[] = [];

  for (const doc of results) {
    const meta = doc.metadata as Record<string, unknown> | undefined;
    if (!meta) continue;

    const sourceNodeId = (meta.nodeId as string) ?? doc.sourceId;
    const compositeScore = meta.compositeScore as number | undefined;
    const grade = (meta.grade as string) ?? "?";

    // Skip: same decision, no score, or also failed
    if (sourceNodeId === failedReport.nodeId) continue;
    if (compositeScore == null || compositeScore < PASS_THRESHOLD) continue;

    // Extract dimension scores from content
    const dimensionScores = parseDimensionScores(doc.content);

    const scoreDelta: ScoreDelta = {
      composite: compositeScore - failedReport.compositeScore,
      friction: dimensionScores.friction - failedReport.friction.score,
      optimality: dimensionScores.optimality - failedReport.optimality.score,
      reversibility: dimensionScores.reversibility - failedReport.reversibility.score,
    };

    const tradeOffs = buildTradeOffs(scoreDelta);

    suggestions.push({
      title: extractTitle(doc.title),
      sourceNodeId,
      estimatedScore: compositeScore,
      grade,
      scoreDelta,
      tradeOffs,
    });
  }

  // Sort by estimated score descending
  suggestions.sort((a, b) => b.estimatedScore - a.estimatedScore);

  // Deduplicate by sourceNodeId
  const seen = new Set<string>();
  const deduped = suggestions.filter((s) => {
    if (seen.has(s.sourceNodeId)) return false;
    seen.add(s.sourceNodeId);
    return true;
  });

  const result = deduped.slice(0, limit);

  logger.info("alternative-suggester:results", {
    nodeId: failedReport.nodeId,
    candidatesFound: suggestions.length,
    returned: result.length,
  });

  return result;
}

// ── Helpers ─────────────────────────────────────────────

function parseDimensionScores(content: string): { friction: number; optimality: number; reversibility: number } {
  const frictionMatch = content.match(/## Friction\nScore:\s*(\d+)/);
  const optimalityMatch = content.match(/## Optimality\nScore:\s*(\d+)/);
  const reversibilityMatch = content.match(/## Reversibility\nScore:\s*(\d+)/);

  return {
    friction: frictionMatch ? parseInt(frictionMatch[1], 10) : 50,
    optimality: optimalityMatch ? parseInt(optimalityMatch[1], 10) : 50,
    reversibility: reversibilityMatch ? parseInt(reversibilityMatch[1], 10) : 50,
  };
}

function extractTitle(docTitle: string): string {
  // Format: "Challenge: Use Redis for sessions [Grade A]" → "Use Redis for sessions"
  const match = docTitle.match(/^Challenge:\s*(.+?)\s*\[Grade/);
  return match ? match[1].trim() : docTitle;
}

function buildTradeOffs(delta: ScoreDelta): string[] {
  const tradeOffs: string[] = [];

  if (delta.friction > 0) tradeOffs.push(`+${delta.friction} friction`);
  else if (delta.friction < 0) tradeOffs.push(`${delta.friction} friction`);

  if (delta.optimality > 0) tradeOffs.push(`+${delta.optimality} optimality`);
  else if (delta.optimality < 0) tradeOffs.push(`${delta.optimality} optimality`);

  if (delta.reversibility > 0) tradeOffs.push(`+${delta.reversibility} reversibility`);
  else if (delta.reversibility < 0) tradeOffs.push(`${delta.reversibility} reversibility`);

  return tradeOffs;
}
