/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * Guard against accidentally moving `onnxruntime-node` into any deps
 * block of `package.json`.
 *
 * Decision rationale: ADR-0055 — ONNX is opt-in, installed by the user
 * via `mcp-graph install-neural` (which runs `npm install onnxruntime-node`
 * without `--save`). Adding it to dependencies / devDependencies /
 * optionalDependencies would defeat the cross-platform zero-friction
 * install promise: prebuilt binaries don't exist for every arch and a
 * failed prebuilt fetch would break `npm install` for everyone.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = resolve(__dirname, "..", "..", "package.json");

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

describe("package.json — onnxruntime-node opt-in invariant", () => {
  const pkg: PackageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8"));

  for (const block of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    it(`onnxruntime-node is NOT in ${block}`, () => {
      const deps = pkg[block] ?? {};
      expect(deps).not.toHaveProperty("onnxruntime-node");
    });
  }
});
