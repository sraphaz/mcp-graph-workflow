/**
 * Contract Coverage Analyzer — checks cross-service contract coverage.
 *
 * Checks:
 * - Each contract node has at least one 'provides' edge (provider)
 * - Each contract node has at least one 'consumes' edge (consumer)
 * - Reports uncovered contracts and overall coverage percentage
 */

import type { GraphDocument } from "../graph/graph-types.js";
import { logger } from "../utils/logger.js";

export interface ContractCoverageReport {
  contracts: Array<{ nodeId: string; title: string; hasProvider: boolean; hasConsumer: boolean }>;
  uncoveredContracts: string[];
  totalContracts: number;
  coveragePercent: number;
}

export function analyzeContractCoverage(doc: GraphDocument): ContractCoverageReport {
  const contractNodes = doc.nodes.filter((n) => n.type === "contract");

  // Build edge lookup: edges where target is a contract
  const providesTargets = new Set<string>();
  const consumesTargets = new Set<string>();

  for (const edge of doc.edges) {
    if (edge.relationType === "provides") {
      // "from" provides "to" — the target (to) is the contract
      providesTargets.add(edge.to);
    }
    if (edge.relationType === "consumes") {
      // "from" consumes "to" — the target (to) is the contract
      consumesTargets.add(edge.to);
    }
  }

  const contracts: ContractCoverageReport["contracts"] = [];
  const uncoveredContracts: string[] = [];

  for (const node of contractNodes) {
    const hasProvider = providesTargets.has(node.id);
    const hasConsumer = consumesTargets.has(node.id);

    contracts.push({ nodeId: node.id, title: node.title, hasProvider, hasConsumer });

    if (!hasProvider || !hasConsumer) {
      uncoveredContracts.push(node.id);
    }
  }

  const coveredCount = contractNodes.length - uncoveredContracts.length;
  const coveragePercent = contractNodes.length > 0
    ? Math.round((coveredCount / contractNodes.length) * 100)
    : 100;

  logger.debug("analyzer:contract-coverage", {
    totalContracts: contractNodes.length,
    coveragePercent,
    uncovered: uncoveredContracts.length,
  });

  return {
    contracts,
    uncoveredContracts,
    totalContracts: contractNodes.length,
    coveragePercent,
  };
}
