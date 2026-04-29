/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-14 LLM-Gateway — Schema flattener: trim JSON Schema before sending
 * tool definitions to model providers. Reduces token cost without changing
 * semantics. Pure function, no I/O.
 */

/**
 * Flatten a JSON Schema by:
 *  1. Resolving local $defs/$ref into inline copies (with cycle protection).
 *  2. Dropping the now-redundant top-level $defs.
 *  3. Removing redundant `minItems: 0` (default) and trivial `default` values
 *     that match the type's natural default (false for boolean, "" for string,
 *     [] for array, {} for object).
 *  4. Preserving all `description` fields (these are what the LLM reads).
 */

type JsonValue = unknown;
type JsonObject = Record<string, JsonValue>;

const DEFS_KEY = "$defs";
const REF_KEY = "$ref";

function isObject(v: JsonValue): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function resolveRef(ref: string, defs: Record<string, JsonValue>): JsonValue | undefined {
  const prefix = "#/$defs/";
  if (!ref.startsWith(prefix)) return undefined;
  return defs[ref.slice(prefix.length)];
}

function isRedundantDefault(propType: unknown, def: unknown): boolean {
  if (def === undefined) return false;
  if (propType === "boolean" && def === false) return true;
  if (propType === "string" && def === "") return true;
  if (propType === "array" && Array.isArray(def) && def.length === 0) return true;
  if (propType === "object" && isObject(def) && Object.keys(def).length === 0) return true;
  return false;
}

function inlineRefs(node: JsonValue, defs: Record<string, JsonValue>, visiting: Set<string>): JsonValue {
  if (Array.isArray(node)) {
    return node.map((item) => inlineRefs(item, defs, visiting));
  }
  if (!isObject(node)) return node;

  if (typeof node[REF_KEY] === "string") {
    const refPath = node[REF_KEY] as string;
    if (visiting.has(refPath)) {
      // Cycle — keep the $ref as-is to avoid infinite expansion.
      return { ...node };
    }
    const resolved = resolveRef(refPath, defs);
    if (resolved !== undefined) {
      visiting.add(refPath);
      const inlined = inlineRefs(resolved, defs, visiting);
      visiting.delete(refPath);
      return inlined;
    }
  }

  const out: JsonObject = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === DEFS_KEY) continue; // strip top-level $defs after inlining
    out[key] = inlineRefs(value, defs, visiting);
  }
  return out;
}

function pruneRedundantFields(node: JsonValue): JsonValue {
  if (Array.isArray(node)) return node.map(pruneRedundantFields);
  if (!isObject(node)) return node;

  const out: JsonObject = { ...node };

  if (out.minItems === 0) {
    delete out.minItems;
  }

  if ("default" in out && isRedundantDefault(out.type, out.default)) {
    delete out.default;
  }

  for (const [key, value] of Object.entries(out)) {
    out[key] = pruneRedundantFields(value);
  }

  return out;
}

export function flattenSchema(schema: JsonValue): JsonValue {
  if (!isObject(schema)) return schema;
  const defs = isObject(schema[DEFS_KEY]) ? (schema[DEFS_KEY] as Record<string, JsonValue>) : {};
  const inlined = inlineRefs(schema, defs, new Set());
  return pruneRedundantFields(inlined);
}

/** Cheap proxy for token cost — JSON-stringified char length. */
export function estimateTokens(schema: JsonValue): number {
  return JSON.stringify(schema).length;
}
