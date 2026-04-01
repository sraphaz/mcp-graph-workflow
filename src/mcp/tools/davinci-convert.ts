import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseDaVinciCode } from "../../core/davinci/davinci-parser.js";
import { resolveVariables } from "../../core/davinci/variable-resolver.js";
import { detectPluginType } from "../../core/davinci/plugin-type-detector.js";
import { generatePom } from "../../core/davinci/pom-generator.js";
import type { TargetSdk } from "../../core/davinci/pom-generator.js";
import { mcpText } from "../response-helpers.js";
import { logger } from "../../core/utils/logger.js";

export function registerDavinciConvert(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "davinci_convert",
    "Convert DaVinci JavaScript code to PingAccess/PingFederate Java plugin. Generates Java class structure, POM.xml, and PF-INF descriptor.",
    {
      code: z.string().describe("DaVinci JavaScript code to convert"),
      pluginName: z.string().describe("Plugin name (kebab-case, e.g. 'my-auth-adapter')"),
      packageName: z.string().describe("Java package name (e.g. 'com.example.adapter')"),
      className: z.string().describe("Java class name (e.g. 'MyAuthAdapter')"),
      targetSdk: z.enum(["pingfederate", "pingaccess"]).optional()
        .describe("Target SDK (default: pingfederate)"),
      pluginType: z.string().optional()
        .describe("Override plugin type (e.g. 'idp-adapter', 'token-generator')"),
    },
    async ({ code, pluginName, packageName, className, targetSdk, pluginType }) => {
      logger.info("davinci: converting code", { pluginName, targetSdk });

      const sdk: TargetSdk = targetSdk ?? "pingfederate";

      const analysis = parseDaVinciCode(code);
      const resolvedVariables = resolveVariables(analysis.variables);
      const detection = detectPluginType(analysis, sdk, {
        sourceCode: code,
        override: pluginType,
      });

      const pomXml = generatePom({
        pluginName,
        packageName,
        className,
        pluginType: detection.pluginType as "idp-adapter",
        attributeContract: [],
        javaVersion: sdk === "pingaccess" ? "17" : "11",
      }, sdk);

      // Generate configure() body from resolved variables
      const configureLines = resolvedVariables
        .filter((v) => v.configureCode)
        .map((v) => `        ${v.configureCode}`)
        .join("\n");

      // Generate GUI field declarations
      const guiFieldLines = resolvedVariables
        .filter((v) => v.guiFieldCode)
        .map((v) => v.guiFieldCode)
        .join("\n        ");

      return mcpText(JSON.stringify({
        ok: true,
        pluginName,
        className,
        packageName,
        pluginType: detection.pluginType,
        confidence: detection.confidence,
        warnings: [...analysis.warnings, ...detection.warnings],
        pomXml,
        configureBody: configureLines || "        // No configuration fields detected",
        guiFields: guiFieldLines || "        // No GUI fields detected",
        resolvedVariables: resolvedVariables.length,
        hint: "Use the generated POM and Java structure to build the plugin. Run davinci_build to compile.",
      }, null, 2));
    },
  );
}
