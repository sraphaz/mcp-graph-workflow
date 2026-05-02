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

/**
 * Siebel Definition of Ready — automated readiness checks for Siebel tasks.
 *
 * Validates: dependency resolution, naming conventions, WSDL availability,
 * BC field existence, and lock conflict detection.
 */

import type { SiebelObject, SiebelObjectType } from "../../schemas/siebel.schema.js";
import { logger } from "../utils/logger.js";

// --- Public types ---

export interface ReadyCheckRequest {
  readonly targetObjects: readonly SiebelObject[];
  readonly repository: readonly SiebelObject[];
  readonly prefix: string;
  readonly currentUser?: string;
  readonly availableWsdls?: readonly string[];
}

export interface ReadyCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface ReadyCheckResult {
  readonly ready: boolean;
  readonly checks: readonly ReadyCheck[];
}

// --- Checks ---

const CHECKABLE_TYPES = new Set<SiebelObjectType>([
  "applet", "business_component", "business_object", "view", "screen",
  "business_service", "integration_object", "workflow",
]);

function checkDependencies(
  targets: readonly SiebelObject[],
  repository: readonly SiebelObject[],
): ReadyCheck | undefined {
  const applets = targets.filter((o) => o.type === "applet");
  if (applets.length === 0) return undefined;

  const repoNames = new Set(repository.map((o) => o.name));
  const targetNames = new Set(targets.map((o) => o.name));
  const missing: string[] = [];

  for (const applet of applets) {
    const busComp = applet.properties.find((p) => p.name === "BUS_COMP")?.value;
    if (busComp && !repoNames.has(busComp) && !targetNames.has(busComp)) {
      missing.push(`${applet.name} → BC "${busComp}"`);
    }
  }

  return {
    name: "dependencies_resolved",
    passed: missing.length === 0,
    detail: missing.length === 0
      ? "All SIF dependencies resolved"
      : `Missing dependencies: ${missing.join(", ")}`,
  };
}

function checkNaming(
  targets: readonly SiebelObject[],
  prefix: string,
): ReadyCheck | undefined {
  const checkable = targets.filter((o) => CHECKABLE_TYPES.has(o.type));
  if (checkable.length === 0) return undefined;

  const violations: string[] = [];
  for (const objValue of checkable) {
    if (!objValue.name.startsWith(prefix)) {
      violations.push(objValue.name);
    }
  }

  return {
    name: "naming_convention",
    passed: violations.length === 0,
    detail: violations.length === 0
      ? `All objects use prefix "${prefix}"`
      : `Objects missing prefix "${prefix}": ${violations.join(", ")}`,
  };
}

function checkWsdlAvailability(
  targets: readonly SiebelObject[],
  availableWsdls: readonly string[],
): ReadyCheck | undefined {
  const ios = targets.filter((o) => o.type === "integration_object");
  if (ios.length === 0) return undefined;

  const wsdlSet = new Set(availableWsdls.map((w) => w.toLowerCase()));
  const missing: string[] = [];

  for (const io of ios) {
    // Try to match IO name to a WSDL file
    const entityName = io.name
      .replace(/^[A-Z]{2,4}_\s*/i, "")
      .replace(/\s*IO$/i, "")
      .trim()
      .toLowerCase();

    const hasWsdl = [...wsdlSet].some(
      (w) => w.includes(entityName) || entityName.includes(w.replace(".wsdl", "")),
    );

    if (!hasWsdl) {
      missing.push(io.name);
    }
  }

  return {
    name: "wsdl_available",
    passed: missing.length === 0,
    detail: missing.length === 0
      ? "All Integration Objects have corresponding WSDLs"
      : `IOs missing WSDLs: ${missing.join(", ")}`,
  };
}

function checkBcFields(
  targets: readonly SiebelObject[],
  repository: readonly SiebelObject[],
): ReadyCheck | undefined {
  const applets = targets.filter((o) => o.type === "applet");
  if (applets.length === 0) return undefined;

  // Build BC field index from repo
  const bcFields = new Map<string, Set<string>>();
  for (const objValue of [...repository, ...targets]) {
    if (objValue.type === "business_component") {
      const fields = new Set(objValue.children.filter((c) => c.type === "field").map((c) => c.name));
      bcFields.set(objValue.name, fields);
    }
  }

  const missingFields: string[] = [];

  for (const applet of applets) {
    const busComp = applet.properties.find((p) => p.name === "BUS_COMP")?.value;
    if (!busComp) continue;

    const fields = bcFields.get(busComp);
    if (!fields) continue; // BC not in repo, already caught by dep check

    for (const control of applet.children) {
      const fieldRef = control.properties.find((p) => p.name === "FIELD")?.value;
      if (fieldRef && !fields.has(fieldRef)) {
        missingFields.push(`${applet.name}: field "${fieldRef}" not in ${busComp}`);
      }
    }
  }

  return {
    name: "bc_fields_exist",
    passed: missingFields.length === 0,
    detail: missingFields.length === 0
      ? "All applet field references valid"
      : `Missing fields: ${missingFields.join(", ")}`,
  };
}

function checkLockConflicts(
  targets: readonly SiebelObject[],
  currentUser?: string,
): ReadyCheck {
  const conflicts: string[] = [];

  for (const objValue of targets) {
    const locked = objValue.properties.find((p) => p.name === "OBJECT_LOCKED")?.value;
    const lockedBy = objValue.properties.find((p) => p.name === "LOCKED_BY")?.value;

    if (locked === "Y" && lockedBy && lockedBy !== currentUser) {
      conflicts.push(`${objValue.name} locked by ${lockedBy}`);
    }
  }

  return {
    name: "no_lock_conflicts",
    passed: conflicts.length === 0,
    detail: conflicts.length === 0
      ? "No lock conflicts"
      : `Lock conflicts: ${conflicts.join(", ")}`,
  };
}

// --- Main function ---

/** checkSiebelReady — auto-generated description placeholder. */
export function checkSiebelReady(request: ReadyCheckRequest): ReadyCheckResult {
  const { targetObjects, repository, prefix, currentUser, availableWsdls = [] } = request;

  logger.debug("definition-of-ready: checking", { targets: targetObjects.length });

  if (targetObjects.length === 0) {
    return { ready: true, checks: [] };
  }

  const checks: ReadyCheck[] = [];

  // AC1: Dependencies
  const depCheck = checkDependencies(targetObjects, repository);
  if (depCheck) checks.push(depCheck);

  // AC2: Naming
  const nameCheck = checkNaming(targetObjects, prefix);
  if (nameCheck) checks.push(nameCheck);

  // AC3: WSDL
  const wsdlCheck = checkWsdlAvailability(targetObjects, availableWsdls);
  if (wsdlCheck) checks.push(wsdlCheck);

  // AC4: BC fields
  const fieldCheck = checkBcFields(targetObjects, repository);
  if (fieldCheck) checks.push(fieldCheck);

  // AC5: Locks
  checks.push(checkLockConflicts(targetObjects, currentUser));

  const ready = checks.every((c) => c.passed);

  logger.info("definition-of-ready: complete", {
    ready,
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
  });

  return { ready, checks };
}
