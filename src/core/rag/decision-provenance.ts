/**
 * Decision Provenance — stub for hook-injected import.
 * Tracks RAG citation provenance for AI decisions.
 */

export interface DecisionProvenance {
  nodeId: string;
  citations: unknown[];
  timestamp: string;
}

export interface CreateProvenanceInput {
  nodeId: string;
  rationale: string;
  citations?: unknown[];
  timestamp?: string;
}

export function createProvenance(_store: unknown, _input?: CreateProvenanceInput): { indexed: boolean } {
  return { indexed: false };
}

export function queryProvenance(_nodeId: string): unknown[] {
  return [];
}

export function getProvenanceChain(_nodeId: string): unknown[] {
  return [];
}
