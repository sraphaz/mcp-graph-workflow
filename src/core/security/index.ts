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

export { sanitizeText, detectExfiltration, sanitizeToolArgs } from "./input-sanitizer.js";
export type { SanitizationReport, ExfiltrationReport, ToolArgsSanitizationResult } from "./input-sanitizer.js";

// Phase 3 — MCP RCE hardening (OX Security disclosure)
export { safeArg, safeArgv, assertCdpMethod } from "./stdio-sanitizer.js";
export {
  validateSource,
  type SourceViolation,
  type SourceValidationResult,
  type ValidateSourceOptions,
} from "./ast-source-validator.js";
export {
  assertTrustedMcpServer,
  isPinnedNpmSpec,
  parseNpxCommand,
  type McpServerSpec,
  type AllowlistOptions,
} from "./registry-allowlist.js";
export {
  wrapToolHandler,
  redactSecrets,
  type AuditEntry,
  type AuditSink,
  type RateLimitConfig,
  type WrapOptions,
  type ToolHandler,
} from "./tool-invocation-audit.js";
