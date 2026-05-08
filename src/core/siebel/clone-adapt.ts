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
 * Clone & Adapt — deep clone a Siebel object and adapt it with renames, field changes, and script updates.
 *
 * Uses sif-diff.ts to generate a structural diff between original and cloned object.
 */

import type { SiebelObject } from "../../schemas/siebel.schema.js";
import { diffSifObjects, type SifDiffResult } from "./sif-diff.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger({ layer: "core", source: "clone-adapt.ts" });

// --- Types ---

export interface CloneAdaptRequest {
  readonly source: SiebelObject;
  readonly newName: string;
  readonly renames: Readonly<Record<string, string>>;
  readonly addChildren?: readonly SiebelObject[];
  readonly removeChildren?: readonly string[];
}

export interface CloneAdaptResult {
  readonly cloned: SiebelObject;
  readonly diff: SifDiffResult;
  readonly renamesApplied: number;
}

// --- Deep clone ---

function deepCloneObject(obj: SiebelObject): SiebelObject {
  return {
    name: obj.name,
    type: obj.type,
    project: obj.project,
    properties: obj.properties.map((p) => ({ name: p.name, value: p.value })),
    children: obj.children.map(deepCloneObject),
    parentName: obj.parentName,
    inactive: obj.inactive,
  };
}

// --- Rename logic ---

function applyRenames(value: string, renames: Readonly<Record<string, string>>): string {
  let resultValue = value;
  for (const [from, to] of Object.entries(renames)) {
    // Use global replace to catch all occurrences
    resultValue = replaceAll(resultValue, from, to);
  }
  return resultValue;
}

function replaceAll(str: string, search: string, replacement: string): string {
  if (search.length === 0) return str;
  let resultValue = str;
  let idx = resultValue.indexOf(search);
  while (idx !== -1) {
    resultValue = resultValue.slice(0, idx) + replacement + resultValue.slice(idx + search.length);
    idx = resultValue.indexOf(search, idx + replacement.length);
  }
  return resultValue;
}

function renameObjectTree(
  obj: SiebelObject,
  newName: string,
  oldName: string,
  renames: Readonly<Record<string, string>>,
): { object: SiebelObject; renamesApplied: number } {
  let renamesApplied = 0;

  // Build full rename map including the object name itself
  const fullRenames: Record<string, string> = { ...renames };
  if (oldName !== newName) {
    fullRenames[oldName] = newName;
  }

  // Rename root object
  const renamedProperties = obj.properties.map((p) => {
    const newValue = applyRenames(p.value, fullRenames);
    if (newValue !== p.value) renamesApplied++;
    return { name: p.name, value: newValue };
  });

  // Rename children recursively
  const renamedChildren = obj.children.map((child) => {
    const newParentName = newName;
    const renamedChild = renameChild(child, newParentName, fullRenames);
    renamesApplied += renamedChild.renamesApplied;
    return renamedChild.object;
  });

  return {
    object: {
      name: newName,
      type: obj.type,
      project: obj.project,
      properties: renamedProperties,
      children: renamedChildren,
      parentName: obj.parentName ? applyRenames(obj.parentName, fullRenames) : undefined,
      inactive: obj.inactive,
    },
    renamesApplied,
  };
}

function renameChild(
  child: SiebelObject,
  newParentName: string,
  renames: Readonly<Record<string, string>>,
): { object: SiebelObject; renamesApplied: number } {
  let renamesApplied = 0;

  // Rename properties (including SCRIPT content)
  const renamedProperties = child.properties.map((p) => {
    const newValue = applyRenames(p.value, renames);
    if (newValue !== p.value) renamesApplied++;
    return { name: p.name, value: newValue };
  });

  // Rename child name if it contains old names
  let newChildName = child.name;
  for (const [from, to] of Object.entries(renames)) {
    if (newChildName.includes(from)) {
      newChildName = replaceAll(newChildName, from, to);
      renamesApplied++;
    }
  }

  // Recursive for nested children
  const renamedChildren = child.children.map((c) => {
    const resultValue = renameChild(c, newChildName, renames);
    renamesApplied += resultValue.renamesApplied;
    return resultValue.object;
  });

  return {
    object: {
      name: newChildName,
      type: child.type,
      project: child.project,
      properties: renamedProperties,
      children: renamedChildren,
      parentName: newParentName,
      inactive: child.inactive,
    },
    renamesApplied,
  };
}

// --- Main function ---

/** cloneAndAdapt — auto-generated description placeholder. */
export function cloneAndAdapt(request: CloneAdaptRequest): CloneAdaptResult {
  const { source, newName, renames, addChildren, removeChildren } = request;

  log.info("clone-adapt", {
    source: source.name,
    newName,
    renameCount: String(Object.keys(renames).length),
  });

  // 1. Deep clone the source
  const cloned = deepCloneObject(source);

  // 2. Apply renames throughout the tree
  const renamed = renameObjectTree(cloned, newName, source.name, renames);
  let resultValue = renamed.object;

  // 3. Remove specified children
  if (removeChildren && removeChildren.length > 0) {
    const removeSet = new Set(removeChildren);
    resultValue = {
      ...resultValue,
      children: resultValue.children.filter((c) => !removeSet.has(c.name)),
    };
  }

  // 4. Add new children
  if (addChildren && addChildren.length > 0) {
    const newChildren = addChildren.map((c) => ({
      ...deepCloneObject(c),
      parentName: newName,
    }));
    resultValue = {
      ...resultValue,
      children: [...resultValue.children, ...newChildren],
    };
  }

  // 5. Generate diff between original and clone
  const diff = diffSifObjects([source], [resultValue]);

  log.info("clone-adapt:complete", {
    childCount: String(resultValue.children.length),
    renamesApplied: String(renamed.renamesApplied),
    diffAdded: String(diff.summary.addedCount),
    diffRemoved: String(diff.summary.removedCount),
    diffModified: String(diff.summary.modifiedCount),
  });

  return {
    cloned: resultValue,
    diff,
    renamesApplied: renamed.renamesApplied,
  };
}
