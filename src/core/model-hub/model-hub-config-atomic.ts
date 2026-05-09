/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-atomic-files-writer — Task 5.1: model-hub.config.json atomic file registration.
 *
 * Registers model-hub.config.json as an atomic-managed JSON file.
 * init  → creates with defaults + _managedSchemaVersion
 * update → preserves existing fields, adds missing defaults, bumps schema version
 *
 * Atomic write via tmpfile + fs.rename (POSIX atomic, same as writer-markdown).
 */

import { readFile, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { WriteResult } from "../atomic-files/types.js";

export const MODEL_HUB_SCHEMA_VERSION = 1;

export const MODEL_HUB_CONFIG_DEFAULTS: Record<string, unknown> = {
  port: 11500,
  host: "127.0.0.1",
  backends: [],
  fallbackChain: [],
};

const CONFIG_FILENAME = "model-hub.config.json";

function buildDefault(): Record<string, unknown> {
  return {
    ...MODEL_HUB_CONFIG_DEFAULTS,
    _managedSchemaVersion: MODEL_HUB_SCHEMA_VERSION,
  };
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = join(tmpdir(), `mhc-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(tmp, content, "utf-8");
  await rename(tmp, filePath);
}

export async function initModelHubConfig(projectDir: string): Promise<WriteResult> {
  const filePath = join(projectDir, CONFIG_FILENAME);
  const content = JSON.stringify(buildDefault(), null, 2) + "\n";
  await atomicWrite(filePath, content);
  return { status: "created" };
}

export async function updateModelHubConfig(projectDir: string): Promise<WriteResult> {
  const filePath = join(projectDir, CONFIG_FILENAME);

  let existing: Record<string, unknown> = {};
  if (existsSync(filePath)) {
    const raw = await readFile(filePath, "utf-8");
    try {
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  // Merge: existing wins for known keys; defaults fill missing keys
  const merged: Record<string, unknown> = { ...MODEL_HUB_CONFIG_DEFAULTS };
  for (const [key, val] of Object.entries(existing)) {
    if (key !== "_managedSchemaVersion") {
      merged[key] = val;
    }
  }
  merged["_managedSchemaVersion"] = MODEL_HUB_SCHEMA_VERSION;

  const content = JSON.stringify(merged, null, 2) + "\n";
  await atomicWrite(filePath, content);
  return { status: "updated" };
}
