import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { calculateDoraMetrics } from "../../core/insights/dora-metrics.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

export function registerForecast(server: McpServer, store: SqliteStore): void {
  server.tool(
    "forecast",
    "Predictive analytics: DORA delivery metrics (deployment frequency, lead time, change failure rate, MTTR). Use for sprint health assessment and delivery predictions.",
    {
      mode: z.enum(["dora"]).describe("Forecast mode"),
    },
    async ({ mode }) => {
      logger.debug("tool:forecast", { mode });

      if (mode === "dora") {
        const metrics = calculateDoraMetrics(store);
        logger.info("tool:forecast:dora:ok", {
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
