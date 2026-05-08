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

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { calculateDoraMetrics } from "../../core/insights/dora-metrics.js";
import { createLogger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

const log = createLogger({ layer: "mcp", source: "forecast.ts" });

/** registerForecast — auto-generated description placeholder. */
export function registerForecast(server: McpServer, store: SqliteStore): void {
  server.tool(
    "forecast",
    "Predictive analytics: DORA delivery metrics (deployment frequency, lead time, change failure rate, MTTR). Use for sprint health assessment and delivery predictions.",
    {
      mode: z.enum(["dora"]).describe("Forecast mode"),
    },
    async ({ mode }) => {
      log.debug("tool:forecast", { mode });

      if (mode === "dora") {
        const metrics = calculateDoraMetrics(store);
        log.info("tool:forecast:dora:ok", {
          deployFreq: metrics.deploymentFrequency,
          trend: metrics.trend,
        });
        return mcpText({
          mode: "dora",
          metrics,
          interpretation: {
            deploymentFrequency: metrics.deploymentFrequency > 2
              ? "Elite: >2 tasks/day"
              : metrics.deploymentFrequency > 0.5
                ? "High: >0.5 tasks/day"
                : "Needs improvement: <0.5 tasks/day",
            leadTime: metrics.leadTime.p85 < 24
              ? "Elite: P85 < 1 day"
              : metrics.leadTime.p85 < 168
                ? "High: P85 < 1 week"
                : "Needs improvement: P85 > 1 week",
            changeFailureRate: metrics.changeFailureRate < 0.05
              ? "Elite: <5%"
              : metrics.changeFailureRate < 0.15
                ? "High: <15%"
                : "Needs improvement: >15%",
            mttr: metrics.mttr < 1
              ? "Elite: <1 hour"
              : metrics.mttr < 24
                ? "High: <1 day"
                : "Needs improvement: >1 day",
          },
        });
      }

      return mcpText({ error: `Unknown forecast mode: ${mode}` });
    },
  );
}
