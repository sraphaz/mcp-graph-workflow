/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-playwright-determinism — Task 3.1: `mcp-graph browser-tests heal <spec>`
 *
 * Thin CLI wrapper. All heal logic lives in core/browser-harness/heal-engine.ts.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { Command } from "commander";
import { runHeal } from "../../core/browser-harness/heal-engine.js";
import type { StepExecutor } from "../../core/browser-harness/heal-engine.js";
import { RecipeSchema } from "../../schemas/recipe.schema.js";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "cli", source: "browser-tests.ts" });

/** browserTestsCommand — browser spec management (heal, etc.). */
export function browserTestsCommand(): Command {
  const cmd = new Command("browser-tests")
    .alias("bt")
    .description("Browser spec management — heal broken steps, validate specs");

  cmd
    .command("heal <spec>")
    .description("Heal a broken Playwright spec by re-executing only the failing step")
    .option("-r, --recipe <path>", "Path to recipe.json (default: <spec-dir>/<spec-basename>.recipe.json)")
    .option("-e, --error <message>", "Playwright error text (reads from stdin if omitted)")
    .option("-n, --node <nodeId>", "Graph node ID to link the run result to")
    .option("--dry-run", "Print the patched spec without writing to disk")
    .action(async (specArg: string, opts: { recipe?: string; error?: string; node?: string; dryRun?: boolean }) => {
      const specPath = resolve(specArg);

      let specContent: string;
      try {
        specContent = readFileSync(specPath, "utf-8");
      } catch {
        log.error("bt:heal:spec-not-found", { specPath });
        process.stderr.write(`Error: spec file not found: ${specPath}\n`);
        process.exit(1);
      }

      const recipePath = opts.recipe
        ? resolve(opts.recipe)
        : join(dirname(specPath), specArg.replace(/\.ts$/, ".recipe.json"));

      let recipe: ReturnType<typeof RecipeSchema.parse>;
      try {
        const raw = readFileSync(recipePath, "utf-8");
        recipe = RecipeSchema.parse(JSON.parse(raw));
      } catch {
        log.error("bt:heal:recipe-not-found", { recipePath });
        process.stderr.write(`Error: recipe file not found or invalid: ${recipePath}\n`);
        process.exit(1);
      }

      const playwrightError = opts.error ?? await readStdin();

      // Stub executor — real CDP execution wired in Phase 4.
      // Reads selector from the recipe step as the "healed" candidate.
      const executor: StepExecutor = async (stepIndex, rec) => {
        const step = rec.steps[stepIndex - 1];
        if (!step) {
          return { ok: false, error: `recipe has no step at index ${stepIndex}` };
        }
        const candidate = step.selector ?? null;
        if (!candidate) {
          return { ok: false, error: `recipe step ${stepIndex} has no selector to try` };
        }
        return { ok: true, newSelector: candidate };
      };

      const result = await runHeal(specContent, recipe, playwrightError, executor);

      switch (result.kind) {
        case "healed": {
          if (opts.dryRun) {
            process.stdout.write(result.patchedSpec);
          } else {
            writeFileSync(specPath, result.patchedSpec, "utf-8");
            process.stdout.write(
              JSON.stringify({ ok: true, outcome: "healed", stepIndex: result.stepIndex, specPath }) + "\n",
            );
          }
          log.info("bt:heal:healed", { specPath, stepIndex: result.stepIndex });
          break;
        }
        case "retry_needed": {
          if (opts.dryRun) {
            process.stdout.write(result.patchedSpec);
          } else {
            writeFileSync(specPath, result.patchedSpec, "utf-8");
            process.stdout.write(
              JSON.stringify({ ok: true, outcome: "retry_needed", stepIndex: result.stepIndex, specPath }) + "\n",
            );
          }
          log.warn("bt:heal:retry-needed", { specPath, stepIndex: result.stepIndex });
          break;
        }
        case "broken_unhealed": {
          process.stdout.write(
            JSON.stringify({ ok: false, outcome: "broken_unhealed", stepIndex: result.stepIndex, error: result.error, nodeId: opts.node ?? null }) + "\n",
          );
          log.error("bt:heal:broken-unhealed", { specPath, stepIndex: result.stepIndex, error: result.error });
          process.exit(1);
        }
      }
    });

  return cmd;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}
