/**
 * Code Context Indexer — captures code analysis results (symbols, flows)
 * into the knowledge store for RAG retrieval.
 */

import type { KnowledgeStore } from "../store/knowledge-store.js";
import { logger } from "../utils/logger.js";

export interface CodeSymbolInput {
  name: string;
  kind: string;
  file: string;
  exported: boolean;
  language?: string;
  docstring?: string;
}

export interface ProcessFlowInput {
  name: string;
  steps: string[];
}

export interface CodeAnalysisInput {
  symbols: CodeSymbolInput[];
  flows: ProcessFlowInput[];
}

export interface IndexResult {
  documentsIndexed: number;
}

/** Split array into chunks of maxSize. */
function chunkArray<T>(arr: T[], maxSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += maxSize) {
    chunks.push(arr.slice(i, i + maxSize));
  }
  return chunks;
}

/**
 * Index code analysis results into the knowledge store.
 */
export function indexCodeAnalysis(
  store: KnowledgeStore,
  analysis: CodeAnalysisInput,
): IndexResult {
  let documentsIndexed = 0;

  // Group symbols by language
  if (analysis.symbols.length > 0) {
    const byLanguage = new Map<string, CodeSymbolInput[]>();
    for (const sym of analysis.symbols) {
      const lang = sym.language ?? "typescript";
      const group = byLanguage.get(lang) ?? [];
      group.push(sym);
      byLanguage.set(lang, group);
    }

    // Create knowledge docs per language, chunked to stay under content size limits
    const MAX_SYMBOLS_PER_CHUNK = 500;
    for (const [language, symbols] of byLanguage) {
      const chunks = chunkArray(symbols, MAX_SYMBOLS_PER_CHUNK);
      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunk = chunks[chunkIdx];
        const symbolLines = chunk.map((s) => {
          let line = `- ${s.kind} ${s.name} (${s.file})${s.exported ? " [exported]" : ""}`;
          if (s.docstring) {
            line += `\n  > ${s.docstring}`;
          }
          return line;
        });
        const chunkLabel = chunks.length > 1 ? ` (chunk ${chunkIdx + 1}/${chunks.length})` : "";
        const content = `# Code Symbols — ${language} (${chunk.length}/${symbols.length} symbols)${chunkLabel}\n\n${symbolLines.join("\n")}`;

        store.insert({
          sourceType: "code_context",
          sourceId: `code_symbols:${language}:${chunkIdx}:${new Date().toISOString()}`,
          title: `Code Symbols — ${language}${chunkLabel} (${chunk.length} symbols)`,
          content,
          metadata: {
            language,
            symbolCount: chunk.length,
            totalSymbols: symbols.length,
            chunkIndex: chunkIdx,
            totalChunks: chunks.length,
            files: [...new Set(chunk.map((s) => s.file))],
            phase: "IMPLEMENT",
            indexedAt: new Date().toISOString(),
          },
        });
        documentsIndexed++;
      }
    }
  }

  // Index process flows
  for (const flow of analysis.flows) {
    const content = `# Process Flow: ${flow.name}\n\n${flow.steps.map((s) => `→ ${s}`).join("\n")}`;

    store.insert({
      sourceType: "code_context",
      sourceId: `code_flow:${flow.name}`,
      title: `Flow: ${flow.name}`,
      content,
      metadata: {
        flowName: flow.name,
        stepCount: flow.steps.length,
        phase: "IMPLEMENT",
        indexedAt: new Date().toISOString(),
      },
    });
    documentsIndexed++;
  }

  logger.info("Code analysis indexed", {
    symbols: analysis.symbols.length,
    flows: analysis.flows.length,
    documentsIndexed,
  });

  return { documentsIndexed };
}
