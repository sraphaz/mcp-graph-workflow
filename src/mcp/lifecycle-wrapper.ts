/**
 * @deprecated — Use unified-gate.ts instead. This file re-exports for backward compatibility.
 * Will be removed in v7.1.
 */

export {
  buildLifecycleBlock,
  appendLifecycleToResponse,
  wrapToolsWithLifecycle,
  wrapToolsWithGates,
  type LifecycleBlock,
  type LifecycleBlockOptions,
  type PhaseKnowledgeSnippet,
} from "./unified-gate.js";
