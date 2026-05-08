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
 * SIF Generator — two-phase SIF generation pipeline.
 *
 * Phase 1 (prepare): Assembles RAG context + prompt for the LLM.
 * Phase 2 (finalize): Validates LLM output, indexes into knowledge store.
 *
 * The module does NOT call any LLM — it stays pure and testable.
 */

import { KnowledgeStore } from "../store/knowledge-store.js";
import { createLogger } from "../utils/logger.js";
import { parseSifContent } from "./sif-parser.js";
import { indexSifContent } from "../../core/rag/siebel-indexer.js";
import {
  assembleSifContext,
  type SifGenerationContext,
} from "./sif-context-assembler.js";
import type {
  SifGenerationRequest,
  SifGenerationResult,
  SifValidationMessage,
  SiebelSifParseResult,
} from "../../schemas/siebel.schema.js";

const log = createLogger({ layer: "core", source: "sif-generator.ts" });

/**
 * Phase 1: Prepare SIF generation context.
 *
 * Returns a structured context with prompt, templates, existing objects,
 * and validation rules for the LLM to use.
 */
export function prepareSifGeneration(
  knowledgeStore: KnowledgeStore,
  request: SifGenerationRequest,
): SifGenerationContext {
  log.info("Preparing SIF generation", {
    types: request.objectTypes.join(","),
    description: request.description.slice(0, 100),
  });

  return assembleSifContext(knowledgeStore, request);
}

/**
 * Phase 2: Finalize SIF generation.
 *
 * Validates the LLM-generated XML, checks for collisions with existing objects,
 * runs best-practice checks, and indexes the result into the knowledge store.
 */
export function finalizeSifGeneration(
  knowledgeStore: KnowledgeStore,
  generatedXml: string,
  request: SifGenerationRequest,
): SifGenerationResult {
  log.info("Finalizing SIF generation", {
    xmlLength: String(generatedXml.length),
    requestTypes: request.objectTypes.join(","),
  });

  const messages: SifValidationMessage[] = [];

  // 1. Parse the generated XML
  let parseResult: SiebelSifParseResult;
  try {
    parseResult = parseSifContent(generatedXml, "generated.sif");
    messages.push({
      level: "info",
      message: `Parsed ${parseResult.objects.length} objects, ${parseResult.dependencies.length} dependencies`,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error("SIF generation validation failed: invalid XML", { error: errMsg });
    messages.push({
      level: "error",
      message: `Invalid SIF XML: ${errMsg}`,
    });

    return {
      sifContent: generatedXml,
      objects: [],
      validation: {
        status: "invalid",
        messages,
        score: 0,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        requestDescription: request.description,
        objectCount: 0,
      },
    };
  }

  // 2. Check for name collisions with existing objects
  checkNameCollisions(knowledgeStore, parseResult, messages);

  // 3. Run best-practice checks
  runBestPracticeChecks(parseResult, messages);

  // 4. Calculate score
  const score = calculateScore(parseResult, messages);

  // 5. Determine status
  const hasErrors = messages.some((m) => m.level === "error");
  const hasWarnings = messages.some((m) => m.level === "warning");
  const status = hasErrors ? "invalid" as const : hasWarnings ? "warnings" as const : "valid" as const;

  // 6. Index into knowledge store (only if valid or warnings)
  if (!hasErrors) {
    try {
      indexSifContent(knowledgeStore, parseResult);
      log.info("Generated SIF indexed into knowledge store", {
        objectCount: String(parseResult.objects.length),
      });
    } catch (err) {
      log.error("Failed to index generated SIF", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const resultValue: SifGenerationResult = {
    sifContent: generatedXml,
    objects: parseResult.objects.map((o) => ({ name: o.name, type: o.type })),
    validation: { status, messages, score },
    metadata: {
      generatedAt: new Date().toISOString(),
      requestDescription: request.description,
      objectCount: parseResult.objects.length,
    },
  };

  log.info("SIF generation finalized", {
    status,
    score: String(score),
    objectCount: String(parseResult.objects.length),
  });

  return resultValue;
}

function checkNameCollisions(
  knowledgeStore: KnowledgeStore,
  parseResult: SiebelSifParseResult,
  messages: SifValidationMessage[],
): void {
  for (const objValue of parseResult.objects) {
    try {
      // Search by object name — simpler query for better FTS5 matching
      const existing = knowledgeStore.search(objValue.name, 10);
      const collision = existing.find(
        (doc) =>
          doc.sourceType === "siebel_sif" &&
          doc.title.toLowerCase().includes(objValue.name.toLowerCase()) &&
          (doc.title.toLowerCase().includes(objValue.type) ||
           doc.title.toLowerCase().includes(objValue.type.replace(/_/g, " "))),
      );

      if (collision) {
        messages.push({
          level: "warning",
          message: `Name collision: ${objValue.type} "${objValue.name}" already exists in indexed objects`,
          objectName: objValue.name,
        });
      }
    } catch {
      // Search might fail on empty knowledge store — that's OK
    }
  }
}

function runBestPracticeChecks(
  parseResult: SiebelSifParseResult,
  messages: SifValidationMessage[],
): void {
  for (const objValue of parseResult.objects) {
    // BCs without TABLE
    if (objValue.type === "business_component") {
      const hasTable = objValue.properties.some((p) => p.name === "TABLE");
      if (!hasTable) {
        messages.push({
          level: "warning",
          message: `Business Component "${objValue.name}" is missing TABLE attribute`,
          objectName: objValue.name,
        });
      }
    }

    // Applets without BUS_COMP
    if (objValue.type === "applet") {
      const hasBusComp = objValue.properties.some((p) => p.name === "BUS_COMP");
      if (!hasBusComp) {
        messages.push({
          level: "warning",
          message: `Applet "${objValue.name}" is missing BUS_COMP attribute`,
          objectName: objValue.name,
        });
      }
    }

    // Views without BUS_OBJECT
    if (objValue.type === "view") {
      const hasBusObject = objValue.properties.some((p) => p.name === "BUS_OBJECT");
      if (!hasBusObject) {
        messages.push({
          level: "warning",
          message: `View "${objValue.name}" is missing BUS_OBJECT attribute`,
          objectName: objValue.name,
        });
      }
    }

    // Objects without name (shouldn't happen but defensive)
    if (!objValue.name || objValue.name.trim() === "") {
      messages.push({
        level: "error",
        message: "Object found without a NAME attribute",
        objectName: "unknown",
      });
    }
  }

  // Check circular dependencies
  if (parseResult.dependencies.length > 0) {
    // Build adjacency map for cycle detection
    const adjMap = new Map<string, string[]>();
    for (const dep of parseResult.dependencies) {
      const fromKey = `${dep.from.type}:${dep.from.name}`;
      const toKey = `${dep.to.type}:${dep.to.name}`;
      const existing = adjMap.get(fromKey) ?? [];
      existing.push(toKey);
      adjMap.set(fromKey, existing);
    }

    // Simple DFS cycle detection
    const visited = new Set<string>();
    const inStack = new Set<string>();

    // Iterative DFS with depth limit to prevent stack overflow on deep graphs
    const MAX_DEPTH = 1000;
    function hasCycle(startNode: string): boolean {
      const stack: Array<{ node: string; depth: number; phase: "enter" | "exit" }> = [
        { node: startNode, depth: 0, phase: "enter" },
      ];
      while (stack.length > 0) {
        const frame = stack.pop();
        if (!frame) break;
        if (frame.phase === "exit") {
          inStack.delete(frame.node);
          continue;
        }
        if (frame.depth > MAX_DEPTH) return true; // treat excessive depth as cycle
        visited.add(frame.node);
        inStack.add(frame.node);
        stack.push({ node: frame.node, depth: frame.depth, phase: "exit" });
        for (const neighbor of adjMap.get(frame.node) ?? []) {
          if (inStack.has(neighbor)) return true;
          if (!visited.has(neighbor)) {
            stack.push({ node: neighbor, depth: frame.depth + 1, phase: "enter" });
          }
        }
      }
      return false;
    }

    for (const key of adjMap.keys()) {
      if (!visited.has(key) && hasCycle(key)) {
        messages.push({
          level: "warning",
          message: "Circular dependency detected in generated objects",
        });
        break;
      }
    }
  }
}

function calculateScore(
  parseResult: SiebelSifParseResult,
  messages: SifValidationMessage[],
): number {
  let score = 100;

  const errors = messages.filter((m) => m.level === "error").length;
  const warnings = messages.filter((m) => m.level === "warning").length;

  // Deduct for errors
  score -= errors * 30;

  // Deduct for warnings
  score -= warnings * 10;

  // Bonus for having dependencies (well-connected objects)
  if (parseResult.dependencies.length > 0) {
    score = Math.min(score + 5, 100);
  }

  // Bonus for having children (detailed objects)
  const hasChildren = parseResult.objects.some((o) => o.children.length > 0);
  if (hasChildren) {
    score = Math.min(score + 5, 100);
  }

  return Math.max(0, Math.min(100, score));
}
