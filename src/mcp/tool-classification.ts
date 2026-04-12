/**
 * Tool classification re-exports from constants.ts (single source of truth).
 * This file exists for backward compatibility — import from constants.ts directly.
 *
 * Resolves bugs #007, #013, #015, #022 — inconsistent whitelists between wrappers.
 */

export { ALWAYS_ALLOWED_TOOLS, READ_ONLY_TOOLS, BOOTSTRAP_TOOLS } from "../core/utils/constants.js";
