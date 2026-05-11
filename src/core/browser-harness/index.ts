/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Browser-harness public surface — barrel export.
 */

export { CdpClient } from "./cdp-client.js";
export type { CdpClientOptions } from "./cdp-client.js";
export { HelpersRegistry } from "./helpers-registry.js";
export type { UpsertHelperInput } from "./helpers-registry.js";
export { HelpersRuntime } from "./helpers-runtime.js";
export { SelfHealService } from "./helper-validator.js";
export type { SelfHealInput, SelfHealResult } from "./helper-validator.js";
export { SessionStore } from "./sessions.js";
export type { ActiveSession } from "./sessions.js";
export { seedBuiltInHelpers, BUILT_IN_HELPER_NAMES } from "./built-in-helpers.js";
export {
  loadGuardrail,
  defaultGuardrail,
  isDomainAllowed,
  isCdpMethodForbidden,
} from "./guardrail-loader.js";
export {
  identifyBrokenStep,
  locateStepBlock,
  patchStepSelector,
  patchStepRetryNeeded,
  checkDoubleData,
  runHeal,
} from "./heal-engine.js";
export type { StepBlock, StepExecutor, StepExecutorResult, HealOutcome } from "./heal-engine.js";
export {
  validateEvidence,
  checkBrowserTestEvidenceComplete,
  SCREENSHOT_REQUIRED_ACTIONS,
} from "./evidence-validator.js";
export type { ValidationMode, EvidenceCheckInput, EvidenceValidationResult } from "./evidence-validator.js";
export { classifyFailure } from "./failure-classifier.js";
export type { FailureKind } from "./failure-classifier.js";
export {
  proposeSelectorCandidates,
  proposeWaitIncrement,
  proposeRecovery,
} from "./recovery-primitives.js";
export type {
  DomElement,
  DomSnapshot,
  RecoveryProposal,
} from "./recovery-primitives.js";
export {
  discoverWsEndpoint,
  maskWsEndpoint,
  parseDevToolsActivePort,
  CdpUnreachableError,
} from "./endpoint-discovery.js";
export type {
  DiscoveredEndpoint,
  DiscoveryOptions,
  DiscoveryDeps,
} from "./endpoint-discovery.js";
