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
 * Smart Field Suggestion — suggests fields for new applets based on
 * frequency analysis of existing applets that use the same BC.
 *
 * Fields are ranked by how many existing applets include them, and
 * classified as required (high frequency), optional (medium), or
 * available (unused but present in BC).
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "field-suggestion.ts" });

// --- Public types ---

export interface FieldSuggestionRequest {
  readonly targetBcName: string;
  readonly repository: readonly SiebelObject[];
  readonly requiredThreshold?: number; // fraction of applets (default 0.6)
}

export interface FieldSuggestion {
  readonly fieldName: string;
  readonly frequency: number; // absolute count of applets using it
  readonly frequencyRatio: number; // 0-1 ratio vs total applets
  readonly classification: "required" | "optional" | "available";
}

export interface FieldSuggestionResult {
  readonly targetBcName: string;
  readonly suggestions: readonly FieldSuggestion[];
  readonly appletCount: number;
  readonly bcFieldCount: number;
  readonly requiredThreshold: number;
}

// --- Implementation ---

/** suggestFields — auto-generated description placeholder. */
export function suggestFields(request: FieldSuggestionRequest): FieldSuggestionResult {
  const { targetBcName, repository, requiredThreshold = 0.6 } = request;

  log.debug("field-suggestion: analyzing", { targetBcName, repoSize: repository.length });

  // Find the target BC
  const targetBc = repository.find(
    (o) => o.type === "business_component" && o.name === targetBcName,
  );

  if (!targetBc) {
    log.debug("field-suggestion: BC not found", { targetBcName });
    return {
      targetBcName,
      suggestions: [],
      appletCount: 0,
      bcFieldCount: 0,
      requiredThreshold,
    };
  }

  // Get all BC field names
  const bcFields = new Set(
    targetBc.children.filter((c) => c.type === "field").map((c) => c.name),
  );

  // Find applets that reference this BC
  const applets = repository.filter(
    (o) =>
      o.type === "applet" &&
      o.properties.some((p) => p.name === "BUS_COMP" && p.value === targetBcName),
  );

  if (applets.length === 0) {
    log.debug("field-suggestion: no applets for BC", { targetBcName });
    return {
      targetBcName,
      suggestions: [],
      appletCount: 0,
      bcFieldCount: bcFields.size,
      requiredThreshold,
    };
  }

  // Count field usage across applets
  const fieldCounts = new Map<string, number>();

  for (const applet of applets) {
    const usedFields = new Set<string>();
    for (const child of applet.children) {
      const fieldProp = child.properties.find((p) => p.name === "FIELD")?.value;
      if (fieldProp) {
        usedFields.add(fieldProp);
      }
      // Also check if child name matches a BC field (control name = field name)
      if (child.type === "control" && bcFields.has(child.name) && !fieldProp) {
        usedFields.add(child.name);
      }
    }
    for (const field of usedFields) {
      fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    }
  }

  // Build suggestions: include all BC fields
  const suggestions: FieldSuggestion[] = [];

  for (const fieldName of bcFields) {
    const count = fieldCounts.get(fieldName) ?? 0;
    const ratio = applets.length > 0 ? count / applets.length : 0;

    let classification: FieldSuggestion["classification"];
    if (count === 0) {
      classification = "available";
    } else if (ratio >= requiredThreshold) {
      classification = "required";
    } else {
      classification = "optional";
    }

    suggestions.push({
      fieldName,
      frequency: count,
      frequencyRatio: Math.round(ratio * 100) / 100,
      classification,
    });
  }

  // Sort: required first, then by frequency desc, then alphabetical
  suggestions.sort((a, b) => {
    const classOrder = { required: 0, optional: 1, available: 2 };
    const classDiff = classOrder[a.classification] - classOrder[b.classification];
    if (classDiff !== 0) return classDiff;
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return a.fieldName.localeCompare(b.fieldName);
  });

  log.info("field-suggestion: complete", {
    targetBcName,
    applets: applets.length,
    suggestions: suggestions.length,
    required: suggestions.filter((s) => s.classification === "required").length,
  });

  return {
    targetBcName,
    suggestions,
    appletCount: applets.length,
    bcFieldCount: bcFields.size,
    requiredThreshold,
  };
}
