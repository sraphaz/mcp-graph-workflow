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
export { SelfHealService } from "./self-heal.js";
export type { SelfHealInput, SelfHealResult } from "./self-heal.js";
export { SessionStore } from "./sessions.js";
export type { ActiveSession } from "./sessions.js";
export { seedBuiltInHelpers, BUILT_IN_HELPER_NAMES } from "./built-in-helpers.js";
export {
  loadGuardrail,
  defaultGuardrail,
  isDomainAllowed,
  isCdpMethodForbidden,
} from "./guardrail-loader.js";
