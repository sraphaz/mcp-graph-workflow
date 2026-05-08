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

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "naming-convention-validator.ts" });

// --- Types ---

export interface PrefixRule {
  readonly prefix: string;
  readonly appliesTo: readonly SiebelObjectType[];
}

export interface CaseRule {
  readonly pattern: "PascalCase" | "snake_case" | "camelCase" | "UPPER_SNAKE";
  readonly appliesTo: readonly SiebelObjectType[];
}

export interface NamingException {
  readonly objectName: string;
  readonly reason: string;
}

export interface NamingRuleSet {
  readonly name: string;
  readonly prefixes: readonly PrefixRule[];
  readonly caseRules: readonly CaseRule[];
  readonly exceptions: readonly NamingException[];
}

export interface NamingViolation {
  readonly objectName: string;
  readonly objectType: SiebelObjectType;
  readonly rule: "prefix" | "case";
  readonly expected: string;
  readonly actual: string;
  readonly severity: "warning" | "error";
}

export interface NamingValidationResult {
  readonly ruleSetName: string;
  readonly status: "valid" | "warnings" | "invalid";
  readonly violations: readonly NamingViolation[];
  readonly checkedCount: number;
  readonly skippedCount: number;
  readonly exceptedCount: number;
}

// --- Default Rule Sets ---
// Users configure their own rule sets per organization/project.
// These are minimal examples for common Siebel patterns.

export const DEFAULT_RULE_SETS: Record<string, NamingRuleSet> = {
  standard: {
    name: "standard",
    prefixes: [
      { prefix: "CX_", appliesTo: ["applet", "business_component", "view", "screen"] },
    ],
    caseRules: [
      { pattern: "PascalCase", appliesTo: ["applet", "view", "screen"] },
    ],
    exceptions: [
      { objectName: "Account", reason: "Base Siebel object" },
      { objectName: "Contact", reason: "Base Siebel object" },
      { objectName: "Service Request", reason: "Base Siebel object" },
      { objectName: "Opportunity", reason: "Base Siebel object" },
      { objectName: "Activity", reason: "Base Siebel object" },
    ],
  },
  multi_prefix: {
    name: "multi_prefix",
    prefixes: [
      { prefix: "CX_", appliesTo: ["applet", "business_component", "view", "screen"] },
      { prefix: "XX_", appliesTo: ["applet", "business_component", "view", "screen"] },
    ],
    caseRules: [
      { pattern: "PascalCase", appliesTo: ["applet", "view", "screen"] },
    ],
    exceptions: [
      { objectName: "Account", reason: "Base Siebel object" },
      { objectName: "Contact", reason: "Base Siebel object" },
    ],
  },
};

// --- Validation Logic ---

function isPascalCase(name: string): boolean {
  // After removing known prefix (e.g., "CX_"), check if remaining words start uppercase
  const words = name.split(/[\s_]+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => /^[A-Z]/.test(w));
}

function isSnakeCase(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name) && !name.includes("__") && !name.endsWith("_");
}

function isCamelCase(name: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(name);
}

function isUpperSnake(name: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(name) && !name.includes("__") && !name.endsWith("_");
}

function checkCase(name: string, pattern: CaseRule["pattern"]): boolean {
  switch (pattern) {
    case "PascalCase":
      return isPascalCase(name);
    case "snake_case":
      return isSnakeCase(name);
    case "camelCase":
      return isCamelCase(name);
    case "UPPER_SNAKE":
      return isUpperSnake(name);
  }
}

function stripPrefix(name: string, prefixes: readonly string[]): string {
  for (const pVar of prefixes) {
    if (name.startsWith(pVar)) {
      return name.slice(pVar.length);
    }
  }
  return name;
}

/** validateNamingConventions — auto-generated description placeholder. */
export function validateNamingConventions(
  objects: readonly SiebelObject[],
  ruleSet: NamingRuleSet,
): NamingValidationResult {
  const violations: NamingViolation[] = [];
  let checkedCount = 0;
  let skippedCount = 0;
  let exceptedCount = 0;

  const exceptionNames = new Set(ruleSet.exceptions.map((e) => e.objectName));
  const prefixesByType = new Map<SiebelObjectType, string[]>();
  const caseRulesByType = new Map<SiebelObjectType, CaseRule["pattern"][]>();

  // Index prefix rules by object type
  for (const rule of ruleSet.prefixes) {
    for (const objType of rule.appliesTo) {
      const existing = prefixesByType.get(objType) ?? [];
      existing.push(rule.prefix);
      prefixesByType.set(objType, existing);
    }
  }

  // Index case rules by object type
  for (const rule of ruleSet.caseRules) {
    for (const objType of rule.appliesTo) {
      const existing = caseRulesByType.get(objType) ?? [];
      existing.push(rule.pattern);
      caseRulesByType.set(objType, existing);
    }
  }

  for (const objValue of objects) {
    // Check if this object type has any rules
    const applicablePrefixes = prefixesByType.get(objValue.type);
    const applicableCaseRules = caseRulesByType.get(objValue.type);

    if (!applicablePrefixes && !applicableCaseRules) {
      skippedCount++;
      continue;
    }

    // Check if object is excepted
    if (exceptionNames.has(objValue.name)) {
      exceptedCount++;
      continue;
    }

    checkedCount++;

    // Check prefix
    if (applicablePrefixes && applicablePrefixes.length > 0) {
      const hasValidPrefix = applicablePrefixes.some((p) => objValue.name.startsWith(p));
      if (!hasValidPrefix) {
        violations.push({
          objectName: objValue.name,
          objectType: objValue.type,
          rule: "prefix",
          expected: `One of: ${applicablePrefixes.join(", ")}`,
          actual: objValue.name.split(/[\s_]/)[0] + "_",
          severity: "warning",
        });
      }
    }

    // Check case
    if (applicableCaseRules && applicableCaseRules.length > 0) {
      const nameToCheck = stripPrefix(
        objValue.name,
        applicablePrefixes ?? [],
      );
      for (const casePattern of applicableCaseRules) {
        if (!checkCase(nameToCheck, casePattern)) {
          violations.push({
            objectName: objValue.name,
            objectType: objValue.type,
            rule: "case",
            expected: `${casePattern} (after prefix removal)`,
            actual: nameToCheck,
            severity: "warning",
          });
        }
      }
    }
  }

  const status: NamingValidationResult["status"] =
    violations.length === 0
      ? "valid"
      : violations.some((v) => v.severity === "error")
        ? "invalid"
        : "warnings";

  log.debug("naming-convention-validator", {
    ruleSet: ruleSet.name,
    checkedCount,
    skippedCount,
    exceptedCount,
    violationCount: violations.length,
    status,
  });

  return {
    ruleSetName: ruleSet.name,
    status,
    violations,
    checkedCount,
    skippedCount,
    exceptedCount,
  };
}
