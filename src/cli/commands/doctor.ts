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

import { Command } from "commander";
import { runDoctor } from "../../core/doctor/doctor-runner.js";
import { getErrorMessage } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import type { CheckResult } from "../../core/doctor/doctor-types.js";

function output(msg: string): void {
  process.stdout.write(msg + "\n");
}

const LEVEL_ICON: Record<string, string> = {
  ok: "\u2713",
  warning: "\u26A0",
  error: "\u2717",
};

function formatCheck(check: CheckResult): string {
  const icon = LEVEL_ICON[check.level] ?? "?";
  let line = `  ${icon} ${check.message}`;
  if (check.suggestion) {
    line += `\n      ${check.suggestion}`;
  }
  return line;
}

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Validate the execution environment")
    .option("-d, --dir <dir>", "Project directory", process.cwd())
    .option("--json", "Output as JSON")
    .action(async (opts: { dir: string; json: boolean }) => {
      try {
        const report = await runDoctor(opts.dir);

        if (opts.json) {
          output(JSON.stringify(report, null, 2));
        } else {
          output("mcp-graph doctor\n");

          for (const check of report.checks) {
            output(formatCheck(check));
          }

          output("");
          output(
            `Summary: ${report.summary.ok} ok, ${report.summary.warning} warnings, ${report.summary.error} errors`,
          );

          if (report.passed) {
            output("\nAll critical checks passed.");
          } else {
            output("\nSome critical checks failed. Fix errors above.");
          }
        }

        if (!report.passed) {
          process.exit(1);
        }
      } catch (err) {
        logger.error(`Doctor failed: ${getErrorMessage(err)}`);
        process.exit(1);
      }
    });
}
