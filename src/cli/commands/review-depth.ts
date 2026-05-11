/*!
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright © 2026 Diego Lima Nogueira de Paula
 *
 * §EPIC-sentrux — Task 2.2: review-depth command retired.
 * The feature-depth Go tool and its TS modules have been removed.
 * Use Sentrux quality gates instead.
 */

import { Command } from "commander";
import { createLogger } from "../../core/utils/logger.js";

const log = createLogger({ layer: "cli", source: "review-depth.ts" });

/** reviewDepthCommand — retired stub; feature-depth was superseded by Sentrux. */
export function reviewDepthCommand(): Command {
  return new Command("review-depth")
    .description("[retired] feature-depth review — use Sentrux quality gates instead")
    .allowUnknownOption()
    .action(() => {
      log.warn("cli:review-depth:retired", {
        hint: "feature-depth has been retired. Use Sentrux advisory gates.",
      });
      process.stdout.write(
        "review-depth is retired. feature-depth scoring has been superseded by Sentrux.\n",
      );
      process.exit(0);
    });
}
