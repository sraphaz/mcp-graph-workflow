/**
 * @deprecated — Use unified-gate.ts instead. This file re-exports for backward compatibility.
 * Will be removed in v7.1.
 */

export {
  wrapToolsWithCodeIntelligence,
  buildCodeIntelBlock,
  buildBlockedResponseCodeIntel,
  detectStaleIndex,
  extractRelevantHints,
  resetStaleWarningDedup,
  type CodeIntelligenceMode,
  type CodeIntelWarning,
  type CodeIntelEnrichment,
  type IndexStatus,
  type CodeIntelligenceBlock,
} from "./unified-gate.js";
