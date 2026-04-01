import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import { resolveVariables } from "../../core/davinci/variable-resolver.js";
import { detectPluginType } from "../../core/davinci/plugin-type-detector.js";
import { mcpText } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

export function registerDavinciAnalyze(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "davinci_analyze",
    "Analyze DaVinci custom code (JavaScript). Extracts variables, API calls, flow logic, detects plugin type, and resolves variable mappings to Java equivalents.",
    {
      code: z.string().describe("DaVinci JavaScript code to analyze"),
      codeLocation: z.enum(["custom_function", "code_snippet", "html_template"]).optional()
        .describe("Code location type (default: auto-detect)"),
      targetSdk: z.enum(["pingfederate", "pingaccess"]).optional()
        .describe("Target SDK for plugin type detection (default: pingfederate)"),
    },
    async ({ code, codeLocation, targetSdk }) => {
      logger.info("davinci: analyzing code", { codeLength: code.length, codeLocation });

      const analysis = parseDaVinciCode(code, {
        codeLocation: codeLocation ?? undefined,
      });

      const resolvedVariables = resolveVariables(analysis.variables);

      const detection = detectPluginType(analysis, targetSdk ?? "pingfederate", {
        sourceCode: code,
      });

      return mcpText(JSON.stringify({
        ok: true,
        analysis,
        resolvedVariables,
        detection,
      }, null, 2));
    },
  );
}
