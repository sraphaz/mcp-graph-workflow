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
 * Wave-12 Sandbox — Stack auto-detection (Camada 1: Resolver prerequisite).
 *
 * Determines which build/test stack a project uses by probing for marker
 * files. Deterministic, filesystem-only, no subprocess spawn. Result feeds
 * the Resolver layer to pick the right dependency-resolution + command set
 * (maven → `mvn verify`, npm → `npm test`, etc.).
 *
 * Priority order (first match wins):
 *   1. npm      — package.json (+ lock = full confidence)
 *   2. maven    — pom.xml
 *   3. gradle   — build.gradle | build.gradle.kts
 *   4. go       — go.mod
 *   5. pip      — requirements.txt | pyproject.toml | setup.py
 *
 * Rationale for npm first: in polyglot repos (React front + Java back), the
 * JavaScript frontend is almost always the one currently being edited by an
 * agent; putting it first minimizes the "auto-detected the wrong thing"
 * surprise. An explicit `stack:` in SandboxBuilderConfig overrides this.
 */

import fs from "node:fs";
import path from "node:path";
import { McpGraphError } from "../utils/errors.js";

export type SandboxStack = "maven" | "gradle" | "npm" | "go" | "pip" | "auto";

export interface StackDetectionResult {
  stack: SandboxStack;
  /** 0 = no evidence, 0.5 = manifest only, 1 = manifest + lock/config. */
  confidence: number;
  /** Relative filenames that contributed to the decision. */
  evidence: string[];
}

interface StackProbe {
  stack: Exclude<SandboxStack, "auto">;
  markers: { manifest: string[]; lock?: string[] };
}

const PROBES: StackProbe[] = [
  { stack: "npm", markers: { manifest: ["package.json"], lock: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"] } },
  { stack: "maven", markers: { manifest: ["pom.xml"] } },
  { stack: "gradle", markers: { manifest: ["build.gradle", "build.gradle.kts"] } },
  { stack: "go", markers: { manifest: ["go.mod"], lock: ["go.sum"] } },
  { stack: "pip", markers: { manifest: ["requirements.txt", "pyproject.toml", "setup.py"], lock: ["poetry.lock", "Pipfile.lock"] } },
];

/** detectStack — auto-generated description placeholder. */
export function detectStack(projectDir: string): StackDetectionResult {
  if (!fs.existsSync(projectDir)) {
    throw new McpGraphError(`Project directory does not exist: ${projectDir}`);
  }

  for (const probe of PROBES) {
    const evidence: string[] = [];
    for (const marker of probe.markers.manifest) {
      if (fs.existsSync(path.join(projectDir, marker))) {
        evidence.push(marker);
        break;
      }
    }
    if (evidence.length === 0) continue;

    let confidence = 0.5;
    if (probe.markers.lock) {
      for (const lock of probe.markers.lock) {
        if (fs.existsSync(path.join(projectDir, lock))) {
          evidence.push(lock);
          confidence = 1;
          break;
        }
      }
    }

    return { stack: probe.stack, confidence, evidence };
  }

  return { stack: "auto", confidence: 0, evidence: [] };
}
