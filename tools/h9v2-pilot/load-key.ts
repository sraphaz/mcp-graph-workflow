/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Load OpenRouter API key from disposable key file or env var.
 * Never logs or returns the key in error messages.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const KEY_FILE_PATH = "workflow-graph/key.txt";

export interface KeyLoadResult {
  source: "file" | "env";
  /** Masked form for logs: sk-...XXXX (last 4 chars) */
  masked: string;
  /** Real key — DO NOT LOG */
  value: string;
}

export function loadApiKey(baseDir: string = process.cwd()): KeyLoadResult {
  // 1. Explicit file path via env (absolute path — for cross-repo key placement)
  const explicitPath = process.env.OPENROUTER_KEY_FILE;
  if (explicitPath && existsSync(explicitPath)) {
    const value = readFileSync(explicitPath, "utf-8").trim();
    if (value.length === 0) {
      throw new Error(`Key file ${explicitPath} exists but is empty`);
    }
    return { source: "file", masked: maskKey(value), value };
  }

  // 2. Relative to baseDir (default cwd)
  const filePath = resolve(baseDir, KEY_FILE_PATH);
  if (existsSync(filePath)) {
    const value = readFileSync(filePath, "utf-8").trim();
    if (value.length === 0) {
      throw new Error(`Key file exists but is empty: ${KEY_FILE_PATH}`);
    }
    return { source: "file", masked: maskKey(value), value };
  }

  // 3. Env var
  const envVal = process.env.OPENROUTER_API_KEY;
  if (envVal && envVal.length > 0) {
    return { source: "env", masked: maskKey(envVal), value: envVal };
  }

  throw new Error(
    `No OpenRouter API key found. Options:\n` +
    `  - set OPENROUTER_KEY_FILE=/absolute/path/to/key.txt\n` +
    `  - place key in ${KEY_FILE_PATH} (gitignored)\n` +
    `  - set OPENROUTER_API_KEY env var`,
  );
}

export function maskKey(key: string): string {
  if (key.length < 8) return "[REDACTED]";
  const prefix = key.slice(0, 3); // "sk-"
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}
