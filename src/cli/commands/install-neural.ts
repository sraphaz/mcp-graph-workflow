/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 */

/**
 * `mcp-graph install-neural` — opt-in to ONNX neural embeddings.
 *
 * Thin Commander wrapper around `runInstallNeural` (core orchestration
 * lives in `src/core/install-neural/`). The CLI only injects the real
 * side-effect dependencies (spawn npm, call download tool, probe runtime).
 */

import { Command } from "commander";
import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  runInstallNeural,
  type DownloadModelResult,
  type InstallNeuralDeps,
  type NpmInstallResult,
} from "../../core/install-neural/install-neural.js";
import {
  ensureOnnxModelDir,
  getOnnxProvider,
  isOnnxAvailable,
} from "../../core/rag/onnx-embeddings.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "cli", source: "install-neural.ts" });

function realNpmInstall(pkg: string): Promise<NpmInstallResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn("npm", ["install", pkg], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, durationMs: Date.now() - start });
      } else {
        resolve({ ok: false, error: `npm install exited with code ${code ?? "null"}` });
      }
    });
  });
}

async function realDownloadModel(modelsDir: string): Promise<DownloadModelResult> {
  try {
    ensureOnnxModelDir(modelsDir);
    const provider = await getOnnxProvider(modelsDir);
    if (provider === null) {
      return { ok: false, error: "getOnnxProvider returned null after download" };
    }
    return { ok: true, modelsDir };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** installNeuralCommand — auto-generated description placeholder. */
export function installNeuralCommand(): Command {
  return new Command("install-neural")
    .description("Opt-in to ONNX neural embeddings (downloads runtime + model ~30s)")
    .option("--dry-run", "List planned actions without executing", false)
    .option(
      "--models-dir <dir>",
      "Models directory",
      join(process.cwd(), "workflow-graph", "models"),
    )
    .action(async (opts: { dryRun: boolean; modelsDir: string }) => {
      const deps: InstallNeuralDeps = {
        npmInstall: realNpmInstall,
        downloadModel: realDownloadModel,
        isOnnxAvailable,
      };

      const resultValue = await runInstallNeural(
        { dryRun: opts.dryRun, modelsDir: opts.modelsDir },
        deps,
      );

      log.info("install-neural", {
        status: resultValue.status,
        steps: resultValue.steps,
        modelsDir: opts.modelsDir,
        ...(resultValue.plannedActions ? { plannedActions: resultValue.plannedActions } : {}),
        ...(resultValue.error ? { error: resultValue.error } : {}),
      });

      if (resultValue.status === "ready") {
        process.stdout.write("\n✓ ONNX neural embeddings ready.\n");
      } else if (resultValue.status === "dry-run") {
        process.stdout.write("\nPlanned actions:\n");
        for (const action of resultValue.plannedActions ?? []) {
          process.stdout.write(`  - ${action}\n`);
        }
      } else if (resultValue.status === "degraded" || resultValue.status === "failed") {
        process.stderr.write(`\n✗ install-neural ${resultValue.status}: ${resultValue.error ?? ""}\n`);
        process.exit(1);
      }
    });
}
