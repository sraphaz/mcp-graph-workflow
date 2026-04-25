/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * Self-heal validator: when the agent submits a new helper source, scan it
 * for forbidden APIs, enforce the size cap, parse it, and persist.
 */

import type Database from "better-sqlite3";
import { HelperValidationError } from "../utils/errors.js";
import {
  HelperSignatureSchema,
  type HelperSignature,
  type HarnessGuardrail,
} from "../../schemas/browser-harness.schema.js";
import type { HelpersRegistry } from "./helpers-registry.js";
import type { HelpersRuntime } from "./helpers-runtime.js";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { validateSource } from "../security/ast-source-validator.js";

const FORBIDDEN_TOKENS = [
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bprocess\b/,
  /\bchild_process\b/,
  /\bFunction\s*\(/,
  /\beval\s*\(/,
  /\bglobalThis\b/,
];

export interface SelfHealInput {
  sessionId: string;
  name: string;
  source: string;
  signature?: HelperSignature;
  guardrail: HarnessGuardrail;
}

export interface SelfHealResult {
  name: string;
  version: number;
}

export class SelfHealService {
  constructor(
    private readonly db: Database.Database,
    private readonly registry: HelpersRegistry,
    private readonly runtime: HelpersRuntime,
  ) {}

  add(input: SelfHealInput): SelfHealResult {
    const violations = this.validate(input);
    if (violations.length > 0) {
      this.audit(input.sessionId, "safety_block", {
        name: input.name,
        violations,
      }, null);
      throw new HelperValidationError(input.name, violations);
    }

    const signature = input.signature ?? { params: [], returns: "unknown" };
    HelperSignatureSchema.parse(signature);

    const record = this.registry.upsert({
      name: input.name,
      source: input.source,
      signature,
      origin: "agent",
      createdBy: input.sessionId,
    });

    this.runtime.invalidate(input.name);
    this.audit(input.sessionId, "add_helper", {
      name: record.name,
      version: record.version,
      bytes: input.source.length,
    }, { ok: true });

    logger.info("bh:self-heal:add", { name: record.name, version: record.version });
    return { name: record.name, version: record.version };
  }

  audit(
    sessionId: string,
    action: string,
    payload: Record<string, unknown>,
    result: Record<string, unknown> | null,
  ): void {
    this.db
      .prepare(
        `INSERT INTO bh_audit (id, session_id, action, payload, result, at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        generateId("bhaud"),
        sessionId,
        action,
        JSON.stringify(payload),
        result ? JSON.stringify(result) : null,
        Date.now(),
      );
  }

  private validate(input: SelfHealInput): string[] {
    const errors: string[] = [];
    const policy = input.guardrail.selfHealPolicy;

    if (input.source.length > policy.maxSourceBytes) {
      errors.push(
        `source exceeds maxSourceBytes (${input.source.length} > ${policy.maxSourceBytes})`,
      );
    }

    for (const re of FORBIDDEN_TOKENS) {
      if (re.test(input.source)) {
        errors.push(`forbidden token matched: ${re.source}`);
      }
    }

    for (const banned of policy.forbiddenApis) {
      const re = new RegExp(`\\b${banned.replace(/\./g, "\\.")}\\b`);
      if (re.test(input.source)) errors.push(`forbidden API: ${banned}`);
    }

    if (!/^\s*\(?\s*async\b|^\s*\(?\s*function\b|^\s*\(/m.test(input.source.trim())) {
      // basic sanity: must look like a function expression
      errors.push("source must be a function expression (async/function/arrow)");
    }

    // Phase 3: AST walk — defeats obfuscation bypasses that regex misses.
    const astResult = validateSource(input.source, {
      maxBytes: policy.maxSourceBytes,
      extraBannedIdentifiers: policy.forbiddenApis.filter((a) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(a)),
    });
    for (const v of astResult.violations) {
      errors.push(`ast ${v.kind}: ${v.message}${v.loc ? ` @${v.loc}` : ""}`);
    }

    return errors;
  }
}
