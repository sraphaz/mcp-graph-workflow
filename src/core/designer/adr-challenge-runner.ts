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
 * ADR Challenge Runner — orchestrates the full challenge flow for decision nodes.
 *
 * Flow: decision node → fitness scoring → JTBD extraction → pre-mortem → report
 * Pure core function called by analyze(mode: "adr_challenge").
 */

import type { SqliteStore } from "../store/sqlite-store.js";
import type { GraphNode } from "../graph/graph-types.js";
import { scoreFriction, scoreOptimality, scoreReversibility, computeDecisionFitness, type Jtbd } from "./decision-fitness.js";
import { assembleChallengeReport, type ChallengeReport } from "./challenge-report.js";
import type { Finding } from "./severity-scoring.js";
import { NodeNotFoundError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

// ── Types ───────────────────────────────────────────────

export interface AdrChallengeResult {
  nodeId: string;
  nodeTitle: string;
  report: ChallengeReport;
}

export interface AllAdrChallengesResult {
  reports: AdrChallengeResult[];
  summary: {
    totalDecisions: number;
    passed: number;
    failed: number;
    avgCompositeScore: number;
  };
}

// ── JTBD Extraction ─────────────────────────────────────

const JTBD_REGEX = /when\s+(.+?),\s*i\s+want\s+(.+?),\s*so\s+(?:i|that\s+i)\s+can\s+(.+?)(?:\.|$)/gi;

function extractJtbds(nodes: GraphNode[]): Jtbd[] {
  const jtbds: Jtbd[] = [];

  for (const node of nodes) {
    if (node.type !== "epic" && node.type !== "requirement") continue;
    const text = `${node.title} ${node.description ?? ""}`;

    let match: RegExpExecArray | null;
    JTBD_REGEX.lastIndex = 0;
    while ((match = JTBD_REGEX.exec(text)) !== null) {
      jtbds.push({
        situation: match[1].trim(),
        motivation: match[2].trim(),
        outcome: match[3].trim(),
        sourceNodeId: node.id,
      });
    }
  }

  return jtbds;
}

// ── Pre-mortem Generation ───────────────────────────────

function generatePreMortemFindings(decision: GraphNode): Finding[] {
  const findings: Finding[] = [];
  const text = (decision.description ?? "").toLowerCase();

  // Technical failure modes
  if (text.includes("migration") || text.includes("schema change")) {
    findings.push({
      message: "Schema migration could fail during deployment, causing downtime",
      source: "premortem",
      dimension: "friction",
      severity: "warning",
    });
  }

  if (text.includes("npm install") || text.includes("dependency")) {
    findings.push({
      message: "External dependency could introduce breaking changes or security vulnerabilities",
      source: "premortem",
      dimension: "friction",
      severity: "info",
    });
  }

  // Adoption failure modes
  if (text.includes("manual step") || text.includes("configuration required")) {
    findings.push({
      message: "Manual configuration steps could be forgotten or misconfigured by developers",
      source: "premortem",
      dimension: "optimality",
      severity: "warning",
    });
  }

  // Operational failure modes
  if (text.includes("vendor") || text.includes("lock-in")) {
    findings.push({
      message: "Vendor lock-in could limit future migration options",
      source: "premortem",
      dimension: "reversibility",
      severity: "critical",
    });
  }

  // Always add at least one generic finding
  if (findings.length === 0) {
    findings.push({
      message: "Decision has no obvious failure modes detected — verify manually",
      source: "premortem",
      dimension: "general",
      severity: "info",
    });
  }

  return findings;
}

// ── Runner Functions ────────────────────────────────────

/**
 * Run ADR challenge for a single decision node.
 * Throws if node doesn't exist or is not a decision type.
 */
export function runAdrChallenge(store: SqliteStore, nodeId: string): AdrChallengeResult {
  const node = store.getNodeById(nodeId);
  if (!node) {
    throw new NodeNotFoundError(nodeId);
  }

  if (node.type !== "decision") {
    throw new Error(`InvalidNodeType: expected 'decision', got '${node.type}'`);
  }

  // 1. Fitness scoring
  const friction = scoreFriction(node);
  const allNodes = store.getAllNodes();
  const jtbds = extractJtbds(allNodes);
  const optimality = scoreOptimality(node, jtbds);
  const reversibility = scoreReversibility(node);
  const fitness = computeDecisionFitness(friction.score, optimality.score, reversibility.score);

  // 2. JTBD test results
  const jtbdResults = jtbds.map((jtbd) => {
    const jtbdWords = new Set([
      ...jtbd.motivation.toLowerCase().split(/\s+/),
      ...jtbd.outcome.toLowerCase().split(/\s+/),
    ]);
    const decisionText = (node.description ?? "").toLowerCase();
    const matched = [...jtbdWords].filter((w) => w.length > 3 && decisionText.includes(w));
    const overlap = jtbdWords.size > 0 ? matched.length / jtbdWords.size : 0;

    return {
      jtbd: `When ${jtbd.situation}, I want ${jtbd.motivation}, so I can ${jtbd.outcome}`,
      result: (overlap >= 0.3 ? "PASS" : overlap >= 0.1 ? "PARTIAL" : "FAIL") as "PASS" | "FAIL" | "PARTIAL",
      score: overlap,
    };
  });

  // 3. Pre-mortem findings
  const preMortemFindings = generatePreMortemFindings(node);

  // 4. Assemble report
  const report = assembleChallengeReport({ fitness, jtbdResults, preMortemFindings });

  logger.info("adr-challenge:run", {
    mode: "adr_challenge",
    nodeId,
    verdict: report.overallVerdict.verdict,
    compositeScore: fitness.composite,
    findingsCount: preMortemFindings.length,
  });

  return { nodeId, nodeTitle: node.title, report };
}

/**
 * Run ADR challenge for ALL decision nodes in the graph.
 * Returns individual reports + consolidated summary.
 */
export function runAllAdrChallenges(store: SqliteStore): AllAdrChallengesResult {
  const allNodes = store.getAllNodes();
  const decisionNodes = allNodes.filter((n) => n.type === "decision");

  const reports: AdrChallengeResult[] = [];
  let totalComposite = 0;
  let passed = 0;
  let failed = 0;

  for (const node of decisionNodes) {
    const result = runAdrChallenge(store, node.id);
    reports.push(result);

    totalComposite += result.report.fitnessScore.composite;
    if (result.report.overallVerdict.verdict === "CHALLENGE_PASSED") {
      passed++;
    } else {
      failed++;
    }
  }

  const summary = {
    totalDecisions: decisionNodes.length,
    passed,
    failed,
    avgCompositeScore: decisionNodes.length > 0
      ? +(totalComposite / decisionNodes.length).toFixed(2)
      : 0,
  };

  logger.info("adr-challenge:run-all", {
    mode: "adr_challenge",
    totalDecisions: summary.totalDecisions,
    passed: summary.passed,
    failed: summary.failed,
    avgScore: summary.avgCompositeScore,
  });

  return { reports, summary };
}
